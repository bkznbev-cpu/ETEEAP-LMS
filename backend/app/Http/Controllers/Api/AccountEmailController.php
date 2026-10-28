<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailChangeRequest;
use App\Rules\EmailDomainExists;
use App\Rules\UniqueEmail;
use App\Support\AuditLogger;
use App\Support\EmailVerificationCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The step after setting a new password: the person adds their own email
 * address (used for "Forgot Password?" codes and announcements), and
 * proves it is real by entering the code sent to it. Until then, every
 * other request is refused (see EnsurePasswordSetupComplete).
 *
 * 1. POST /api/account/email         {email}  checks it and emails a 6-digit code
 * 2. POST /api/account/email/verify  {code}   the right code saves the email
 *    POST /api/account/email/resend           a new code (once a minute)
 */
class AccountEmailController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->needsEmail()) {
            return response()->json([
                'success' => false,
                'message' => 'Your email address is already confirmed. Use "Change Email" on your profile to change it.',
            ], 409);
        }

        $validated = $request->validate([
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                new EmailDomainExists(),
                new UniqueEmail($user->id),
            ],
        ], [
            'email.required' => 'Please enter your email address.',
            'email.email' => 'Please enter a valid email address.',
        ]);

        $email = mb_strtolower(trim($validated['email']));
        $pending = EmailChangeRequest::where('user_id', $user->id)->first();

        // Same address again within a minute: keep the code already sent.
        if (
            $pending
            && $pending->new_email === $email
            && !$pending->isExpired()
            && EmailVerificationCode::waitBeforeResend($pending) > 0
        ) {
            return $this->codeSent($email, 'A code was already sent to ' . EmailVerificationCode::mask($email) . '. Check your inbox (and spam folder).');
        }

        if (!EmailVerificationCode::send($user, $email, 'on the account setup page')) {
            return $this->mailFailed();
        }

        AuditLogger::log('email_verification_sent', AuditLogger::OWN_ACCOUNT, [
            'actor' => $user,
            'target' => $user,
            'new' => ['pending_email' => $email],
            'details' => 'Sent a verification code to the email they are adding',
            'request' => $request,
        ]);

        return $this->codeSent($email, 'We sent a 6-digit code to ' . EmailVerificationCode::mask($email) . '. Enter it to confirm your email.');
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

        if ($error = EmailVerificationCode::check($pending, (string) $request->input('code'))) {
            return $this->fieldError('code', $error);
        }

        $email = $pending->new_email;

        // Someone else may have taken the address in the meantime.
        if (UniqueEmail::taken($email, $user->id)) {
            $pending->delete();

            return $this->fieldError('code', UniqueEmail::MESSAGE . ' Please enter a different one.');
        }

        $old = $user->email;

        DB::transaction(function () use ($user, $pending, $email): void {
            $user->confirmEmail($email);

            $pending->delete();
        });

        AuditLogger::log('email_added', AuditLogger::OWN_ACCOUNT, [
            'actor' => $user,
            'target' => $user,
            'old' => ['email' => $old],
            'new' => ['email' => $email],
            'details' => 'Added and verified their email address after setting a new password',
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Your email address has been confirmed.',
            'user' => $user->fresh()->only(['id', 'name', 'email', 'school_id', 'program', 'contact', 'role']),
        ]);
    }

    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();
        $pending = EmailChangeRequest::where('user_id', $user->id)->first();

        if (!$pending) {
            return $this->fieldError('code', 'There is no email waiting for verification. Please enter your email again.');
        }

        if ($wait = EmailVerificationCode::waitBeforeResend($pending)) {
            return response()->json([
                'success' => false,
                'message' => "Please wait {$wait} seconds before asking for a new code.",
                'resend_after' => $wait,
            ], 429);
        }

        $email = $pending->new_email;

        if (!EmailVerificationCode::send($user, $email, 'on the account setup page')) {
            return $this->mailFailed();
        }

        return $this->codeSent($email, 'A new code was sent to ' . EmailVerificationCode::mask($email) . '. The old code no longer works.');
    }

    private function codeSent(string $email, string $message): JsonResponse
    {
        return response()->json([
            'success' => true,
            'verification_required' => true,
            'message' => $message,
            'pending_email' => EmailVerificationCode::mask($email),
            'expires_in_minutes' => EmailVerificationCode::MINUTES,
            'resend_after' => EmailVerificationCode::RESEND_SECONDS,
        ]);
    }

    private function mailFailed(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'The verification email could not be sent right now. Please try again later or contact your administrator.',
        ], 503);
    }

    private function fieldError(string $field, string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => [$field => [$message]],
        ], 422);
    }
}
