<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailChangeRequest;
use App\Models\User;
use App\Notifications\EmailChangeAlert;
use App\Notifications\EmailChangeCode;
use App\Rules\EmailDomainExists;
use App\Rules\UniqueEmail;
use App\Support\AuditLogger;
use App\Support\EmailVerificationCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Changing your own email address (every role), with verification:
 *
 * 1. POST   /api/account/email-change         {new_email, current_password}
 *    Checks the format, that no other account uses the address, and the
 *    current password. Emails a 6-digit code to the NEW address and a
 *    notice to the old one. The account's email does not change yet.
 * 2. POST   /api/account/email-change/verify  {code}
 *    The right code changes the email (and marks it verified).
 * 3. POST   /api/account/email-change/resend  sends a new code (once a minute).
 *    DELETE /api/account/email-change          cancels the request.
 *    GET    /api/account/email-change          the current email and any pending change.
 *
 * Every route works only on the signed-in person's own account. Codes are
 * stored hashed, expire after 15 minutes, work once, and are cancelled
 * after 5 wrong tries. The code is never returned or logged.
 */
class EmailChangeController extends Controller
{
    public const CODE_MINUTES = 15;
    public const MAX_WRONG_TRIES = 5;
    public const RESEND_SECONDS = 60;

    /** Wrong current passwords allowed per account in 15 minutes. */
    private const MAX_PASSWORD_TRIES = 5;

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            ...$this->state($user),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'new_email' => ['required', 'string', 'email', 'max:255', new EmailDomainExists()],
            'current_password' => ['required', 'string', 'max:255'],
        ], [
            'new_email.required' => 'Please enter your new email address.',
            'new_email.email' => 'Please enter a valid email address, like name@example.com.',
            'new_email.max' => 'The email address is too long.',
            'current_password.required' => 'Please enter your current password to confirm it is you.',
        ]);

        $newEmail = mb_strtolower(trim($validated['new_email']));

        if ($user->email !== null && mb_strtolower($user->email) === $newEmail) {
            return $this->fieldError('new_email', 'This is already your email address.');
        }

        if ($this->emailIsTaken($newEmail, $user)) {
            return $this->fieldError('new_email', UniqueEmail::MESSAGE);
        }

        // Confirm it is the account owner (limited tries).
        $passwordKey = 'email-change-password:' . $user->id;

        if (RateLimiter::tooManyAttempts($passwordKey, self::MAX_PASSWORD_TRIES)) {
            $minutes = max(1, (int) ceil(RateLimiter::availableIn($passwordKey) / 60));

            return response()->json([
                'success' => false,
                'message' => "Too many wrong passwords. Please try again in {$minutes} minute" . ($minutes === 1 ? '' : 's') . '.',
            ], 429);
        }

        if (!Hash::check($validated['current_password'], $user->password)) {
            RateLimiter::hit($passwordKey, 900);

            AuditLogger::log('email_change_refused', AuditLogger::OWN_ACCOUNT, [
                'actor' => $user,
                'target' => $user,
                'result' => 'failed',
                'details' => 'Email change refused: wrong current password',
                'request' => $request,
            ]);

            return $this->fieldError('current_password', 'Your current password is incorrect.');
        }

        RateLimiter::clear($passwordKey);

        $pending = EmailChangeRequest::where('user_id', $user->id)->first();

        // The same address asked again within a minute: keep the code already sent.
        if (
            $pending &&
            $pending->new_email === $newEmail &&
            !$pending->isExpired() &&
            $pending->last_sent_at->gt(now()->subSeconds(self::RESEND_SECONDS))
        ) {
            return response()->json([
                'success' => true,
                'message' => 'Email verification pending. A code was already sent to ' . self::mask($newEmail) . '. Check your inbox (and spam folder).',
                ...$this->state($user),
            ]);
        }

        if ($error = $this->sendCode($user, $newEmail)) {
            return $error;
        }

        // Tell the old address (when there is one) that a change was asked for.
        $this->alertOldEmail($user, $user->email, EmailChangeAlert::REQUESTED, $newEmail);

        AuditLogger::log('email_change_requested', AuditLogger::OWN_ACCOUNT, [
            'actor' => $user,
            'target' => $user,
            'old' => ['email' => $user->email],
            'new' => ['pending_email' => $newEmail],
            'details' => 'Asked to change their email address; verification code sent to the new address',
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Email verification pending. We sent a 6-digit code to ' . self::mask($newEmail)
                . '. Enter it below to finish. Your current email stays active until then.',
            ...$this->state($user),
        ]);
    }

    public function verify(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ], [
            'code.required' => 'Please enter the 6-digit code from the email.',
            'code.regex' => 'The verification code is 6 numbers.',
        ]);

        $pending = EmailChangeRequest::where('user_id', $user->id)->first();

        if (!$pending) {
            return $this->fieldError('code', 'There is no email change waiting for verification. Please start again.');
        }

        if ($pending->isExpired()) {
            $pending->delete();

            return $this->fieldError('code', 'The verification code has expired. Please request a new code.');
        }

        if ($pending->attempts >= self::MAX_WRONG_TRIES) {
            $pending->delete();

            return $this->fieldError('code', 'Too many wrong codes. The request was cancelled; please start again.');
        }

        if (!Hash::check((string) $request->input('code'), $pending->code_hash)) {
            $pending->increment('attempts');
            $left = self::MAX_WRONG_TRIES - $pending->attempts;

            if ($left <= 0) {
                $pending->delete();

                AuditLogger::log('email_change_refused', AuditLogger::OWN_ACCOUNT, [
                    'actor' => $user,
                    'target' => $user,
                    'result' => 'failed',
                    'details' => 'Email change cancelled after too many wrong verification codes',
                    'request' => $request,
                ]);

                return $this->fieldError('code', 'Too many wrong codes. The request was cancelled; please start again.');
            }

            return $this->fieldError(
                'code',
                'The verification code is incorrect. ' . $left . ' ' . ($left === 1 ? 'try' : 'tries') . ' left.'
            );
        }

        $newEmail = $pending->new_email;

        // Someone else may have taken the address in the meantime.
        if ($this->emailIsTaken($newEmail, $user)) {
            $pending->delete();

            return $this->fieldError('code', UniqueEmail::MESSAGE . ' Please choose a different one.');
        }

        $oldEmail = $user->email;

        DB::transaction(function () use ($user, $pending, $newEmail) {
            $user->confirmEmail($newEmail);

            // The code cannot be used again.
            $pending->delete();
        });

        AuditLogger::log('email_changed', AuditLogger::OWN_ACCOUNT, [
            'actor' => $user,
            'target' => $user,
            'old' => ['email' => $oldEmail],
            'new' => ['email' => $newEmail],
            'details' => 'Changed their email address after verifying the new address',
            'request' => $request,
        ]);

        $this->alertOldEmail($user, $oldEmail, EmailChangeAlert::COMPLETED, $newEmail);

        return response()->json([
            'success' => true,
            'message' => 'Your email address has been changed to ' . $newEmail . '.',
            ...$this->state($user->fresh()),
        ]);
    }

    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();
        $pending = EmailChangeRequest::where('user_id', $user->id)->first();

        if (!$pending) {
            return response()->json([
                'success' => false,
                'message' => 'There is no email change waiting for verification.',
            ], 422);
        }

        $wait = self::RESEND_SECONDS - (int) $pending->last_sent_at->diffInSeconds(now());

        if ($wait > 0) {
            return response()->json([
                'success' => false,
                'message' => "Please wait {$wait} seconds before asking for a new code.",
                'resend_after' => $wait,
            ], 429);
        }

        if ($this->emailIsTaken($pending->new_email, $user)) {
            $pending->delete();

            return $this->fieldError('new_email', UniqueEmail::MESSAGE . ' Please choose a different one.');
        }

        if ($error = $this->sendCode($user, $pending->new_email)) {
            return $error;
        }

        return response()->json([
            'success' => true,
            'message' => 'A new code was sent to ' . self::mask($pending->new_email) . '. The old code no longer works.',
            ...$this->state($user),
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $request->user();
        $deleted = EmailChangeRequest::where('user_id', $user->id)->delete();

        if ($deleted) {
            AuditLogger::log('email_change_cancelled', AuditLogger::OWN_ACCOUNT, [
                'actor' => $user,
                'target' => $user,
                'details' => 'Cancelled their pending email change',
                'request' => $request,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'The email change was cancelled. Your email address was not changed.',
            ...$this->state($user),
        ]);
    }

    /**
     * Creates (or replaces) the pending request with a new code and emails
     * it to the new address. Returns an error response if mail fails.
     */
    private function sendCode(User $user, string $newEmail): ?JsonResponse
    {
        if (!EmailVerificationCode::send($user, $newEmail, 'on your profile page')) {
            return response()->json([
                'success' => false,
                'message' => 'The verification email could not be sent right now, so your email was not changed. '
                    . 'Please try again later or contact your administrator.',
            ], 503);
        }

        return null;
    }

    /** Best effort: a problem sending this notice never blocks the change. */
    private function alertOldEmail(User $user, ?string $oldEmail, string $stage, string $newEmail): void
    {
        if (trim((string) $oldEmail) === '') {
            return;
        }

        try {
            Notification::route('mail', $oldEmail)->notify(
                new EmailChangeAlert($stage, self::mask($newEmail), (string) $user->name, (string) $user->school_id)
            );
        } catch (\Throwable $error) {
            Log::warning('Email change notice to the old address could not be sent.', [
                'user_id' => $user->id,
                'stage' => $stage,
                'error' => $error->getMessage(),
            ]);
        }
    }

    private function emailIsTaken(string $email, User $user): bool
    {
        return UniqueEmail::taken($email, $user->id);
    }

    /** What the profile page shows (never the code). */
    private function state(User $user): array
    {
        $pending = EmailChangeRequest::where('user_id', $user->id)->first();

        if ($pending && $pending->isExpired()) {
            $pending->delete();
            $pending = null;
        }

        return [
            'email' => $user->email,
            'email_verified' => $user->email_verified_at !== null,
            'pending' => $pending ? [
                'new_email' => $pending->new_email,
                'expires_at' => $pending->expires_at->toIso8601String(),
                'resend_after' => max(0, self::RESEND_SECONDS - (int) $pending->last_sent_at->diffInSeconds(now())),
                'tries_left' => max(0, self::MAX_WRONG_TRIES - $pending->attempts),
            ] : null,
        ];
    }

    private function fieldError(string $field, string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => [$field => [$message]],
        ], 422);
    }

    /** name@example.com -> na**@example.com */
    public static function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $visible = mb_substr($local, 0, min(2, max(1, mb_strlen($local) - 1)));

        return $visible . str_repeat('*', max(2, mb_strlen($local) - mb_strlen($visible))) . '@' . $domain;
    }
}
