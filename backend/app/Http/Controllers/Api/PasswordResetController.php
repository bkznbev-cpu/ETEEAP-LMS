<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\ResetPasswordCode;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * "Forgot password" with a 5-digit code sent by email, for every role.
 *
 * 1. POST /api/password/forgot       {school_id, email}
 *    Emails a 5-digit code when the School ID and the email saved during
 *    account setup belong to the same active account. Anything else is
 *    refused with a "failed" message (rate limited: 5 per minute).
 * 2. POST /api/password/verify-code  {email, code}
 *    Checks the code so the page can move on to the new password.
 * 3. POST /api/password/reset        {email, code, password, password_confirmation}
 *    Sets the new password and signs the account out everywhere.
 *
 * Codes are stored hashed (password_reset_tokens), expire after
 * 15 minutes, stop working after 5 wrong tries, and a new code can be
 * requested once a minute.
 */
class PasswordResetController extends Controller
{
    public const CODE_MINUTES = 15;
    public const MAX_WRONG_TRIES = 5;
    private const RESEND_SECONDS = 60;

    private const SENT_MESSAGE =
        'A 5-digit verification code has been sent to your email address. '
        . 'Check your inbox (and spam folder). The code expires in 15 minutes.';

    private const EMAIL_NOT_FOUND =
        'The School ID and email address do not match any account. '
        . 'Use your School ID and the email you added when you set up your account, or contact your administrator.';

    private const INVALID_CODE =
        'The verification code is incorrect or has expired.';

    private const TOO_MANY_TRIES =
        'Too many wrong codes. Please request a new code.';

    public function forgot(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'school_id' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255'],
        ], [
            'school_id.required' => 'Please enter your School ID.',
            'email.required' => 'Please enter your email address.',
            'email.email' => 'Please enter a valid email address.',
        ]);

        // The School ID and the email saved when the account was set up
        // must both belong to the same account. Anything else fails.
        // (Up to 2 accounts can share an email; the School ID picks one.)
        $user = $this->findAccount($validated['email'], $validated['school_id']);

        if (!$user || !$user->password_setup_complete) {
            return response()->json([
                'success' => false,
                'message' => self::EMAIL_NOT_FOUND,
            ], 422);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'This account is deactivated. Please contact your administrator.',
            ], 422);
        }

        $existing = DB::table('password_reset_tokens')->where('email', $this->tokenKey($user))->first();
        $recentlySent = $existing
            && Carbon::parse($existing->created_at)->gt(now()->subSeconds(self::RESEND_SECONDS));

        if (!$recentlySent) {
            // 5 digits, leading zeros allowed (00000 to 99999).
            $code = str_pad((string) random_int(0, 99999), 5, '0', STR_PAD_LEFT);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $this->tokenKey($user)],
                ['token' => Hash::make($code), 'created_at' => now()]
            );
            RateLimiter::clear($this->triesKey($user));

            try {
                $user->notify(new ResetPasswordCode($code, self::CODE_MINUTES));
            } catch (\Throwable $error) {
                DB::table('password_reset_tokens')->where('email', $this->tokenKey($user))->delete();

                // Mail server problems are logged for the administrator.
                Log::error('Password reset code could not be emailed.', [
                    'user_id' => $user->id,
                    'error' => $error->getMessage(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'The verification code could not be sent right now. Please try again later or contact your administrator.',
                ], 503);
            }

            // Authentication (never 'Academic Admin Accounts'), whatever the role.
            AuditLogger::log('reset_code_sent', AuditLogger::AUTH, [
                'actor' => $user,
                'target' => $user,
                'details' => 'Asked for a password reset code by email',
                'request' => $request,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => self::SENT_MESSAGE,
            'resend_after' => self::RESEND_SECONDS,
        ]);
    }

    public function verifyCode(Request $request): JsonResponse
    {
        $this->validateCodeRequest($request);

        if ($response = $this->checkCode($request)) {
            return $response;
        }

        return response()->json([
            'success' => true,
            'message' => 'Code verified. Choose your new password.',
        ]);
    }

    public function reset(Request $request): JsonResponse
    {
        $this->validateCodeRequest($request);

        $user = $this->findAccount($request->input('email'), $request->input('school_id'));

        // System Administrators need a longer password, as elsewhere.
        $minimum = $user?->role === 'system_admin' ? 15 : 8;

        $request->validate([
            'password' => ['required', 'string', "min:{$minimum}", 'max:255', 'confirmed'],
        ], [
            'password.min' => "The new password must be at least {$minimum} characters.",
            'password.confirmed' => 'The new passwords do not match.',
        ]);

        if ($response = $this->checkCode($request)) {
            return $response;
        }

        DB::transaction(function () use ($user, $request) {
            $user->password = $request->input('password'); // hashed by the model
            $user->password_setup_complete = true;
            $user->save();

            // The code can't be used again; sign out every device.
            DB::table('password_reset_tokens')->where('email', $this->tokenKey($user))->delete();
            $user->tokens()->delete();
        });

        RateLimiter::clear($this->triesKey($user));
        AuditLogger::log('password_reset', AuditLogger::AUTH, [
            'actor' => $user,
            'target' => $user,
            'details' => 'Reset their password with the emailed code',
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Your password has been reset. You can now log in with your new password.',
        ]);
    }

    private function validateCodeRequest(Request $request): void
    {
        $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'school_id' => ['nullable', 'string', 'max:100'],
            'code' => ['required', 'string', 'regex:/^\d{5}$/'],
        ], [
            'code.required' => 'Please enter the 5-digit code from the email.',
            'code.regex' => 'The verification code is 5 numbers.',
        ]);
    }

    /**
     * Null when the code is right; otherwise the error response. Wrong
     * tries are counted, and the code is cancelled after too many.
     */
    private function checkCode(Request $request): ?JsonResponse
    {
        $user = $this->findAccount($request->input('email'), $request->input('school_id'));
        $record = $user
            ? DB::table('password_reset_tokens')->where('email', $this->tokenKey($user))->first()
            : null;

        if (!$user || !$user->is_active || !$record) {
            return $this->codeError(self::INVALID_CODE);
        }

        if (Carbon::parse($record->created_at)->lt(now()->subMinutes(self::CODE_MINUTES))) {
            DB::table('password_reset_tokens')->where('email', $this->tokenKey($user))->delete();
            return $this->codeError('The verification code has expired. Please request a new code.');
        }

        $key = $this->triesKey($user);

        if (RateLimiter::tooManyAttempts($key, self::MAX_WRONG_TRIES)) {
            DB::table('password_reset_tokens')->where('email', $this->tokenKey($user))->delete();
            return $this->codeError(self::TOO_MANY_TRIES);
        }

        if (!Hash::check((string) $request->input('code'), $record->token)) {
            RateLimiter::hit($key, self::CODE_MINUTES * 60);
            $left = self::MAX_WRONG_TRIES - RateLimiter::attempts($key);

            if ($left <= 0) {
                DB::table('password_reset_tokens')->where('email', $this->tokenKey($user))->delete();
                return $this->codeError(self::TOO_MANY_TRIES);
            }

            return $this->codeError(self::INVALID_CODE . " {$left} " . ($left === 1 ? 'try' : 'tries') . ' left.');
        }

        return null;
    }

    private function codeError(string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => ['code' => [$message]],
        ], 422);
    }

    /**
     * The account with this email (and School ID, when given). Up to 2
     * accounts can share an email, so without a School ID only an email
     * used by exactly one account is accepted.
     */
    private function findAccount(?string $email, ?string $schoolId): ?User
    {
        $email = mb_strtolower(trim((string) $email));
        $schoolId = mb_strtolower(trim((string) $schoolId));

        if ($email === '') {
            return null;
        }

        $matches = User::whereRaw('LOWER(TRIM(email)) = ?', [$email])
            ->when($schoolId !== '', fn ($query) => $query->whereRaw('LOWER(TRIM(school_id)) = ?', [$schoolId]))
            ->limit(2)
            ->get();

        return $matches->count() === 1 ? $matches->first() : null;
    }

    /** Reset codes are kept per account, as 2 accounts may share an email. */
    private function tokenKey(User $user): string
    {
        return 'user:' . $user->id;
    }

    private function triesKey(User $user): string
    {
        return 'password-reset-code:user:' . $user->id;
    }
}
