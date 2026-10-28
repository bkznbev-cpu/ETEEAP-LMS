<?php

namespace App\Support;

use App\Models\EmailChangeRequest;
use App\Models\User;
use App\Notifications\EmailChangeCode;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * The 6-digit code that proves someone can read mail at an address.
 * Used by "Add your email" (account setup) and "Change Email".
 * One pending code per account, stored hashed, valid for 15 minutes,
 * cancelled after 5 wrong tries. The code is never returned or logged.
 */
class EmailVerificationCode
{
    public const MINUTES = 15;
    public const MAX_WRONG_TRIES = 5;
    public const RESEND_SECONDS = 60;

    /**
     * Creates (or replaces) the pending code and emails it.
     * Returns false when the email could not be sent.
     */
    public static function send(User $user, string $email, string $where): bool
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $pending = EmailChangeRequest::updateOrCreate(
            ['user_id' => $user->id],
            [
                'new_email' => $email,
                'code_hash' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(self::MINUTES),
                'last_sent_at' => now(),
            ]
        );

        try {
            Notification::route('mail', $email)->notify(
                new EmailChangeCode($code, self::MINUTES, (string) $user->name, (string) $user->school_id, $where)
            );
        } catch (\Throwable $error) {
            $pending->delete();

            // Logged for the administrator, without the code.
            Log::error('Email verification code could not be sent.', [
                'user_id' => $user->id,
                'error' => $error->getMessage(),
            ]);

            return false;
        }

        return true;
    }

    /**
     * Checks a code. Returns null when it is right, else the error to show.
     * A wrong code counts as a try; too many cancel the request.
     */
    public static function check(?EmailChangeRequest $pending, string $code): ?string
    {
        if (!$pending) {
            return 'There is no email waiting for verification. Please enter your email again.';
        }

        if ($pending->isExpired()) {
            $pending->delete();

            return 'The verification code has expired. Please request a new code.';
        }

        if ($pending->attempts >= self::MAX_WRONG_TRIES) {
            $pending->delete();

            return 'Too many wrong codes. Please enter your email again to get a new code.';
        }

        if (!Hash::check($code, $pending->code_hash)) {
            $pending->increment('attempts');
            $left = self::MAX_WRONG_TRIES - $pending->attempts;

            if ($left <= 0) {
                $pending->delete();

                return 'Too many wrong codes. Please enter your email again to get a new code.';
            }

            return 'The verification code is incorrect. ' . $left . ' ' . ($left === 1 ? 'try' : 'tries') . ' left.';
        }

        return null;
    }

    /** Seconds left before another code may be sent (0 = now). */
    public static function waitBeforeResend(EmailChangeRequest $pending): int
    {
        return max(0, self::RESEND_SECONDS - (int) $pending->last_sent_at->diffInSeconds(now()));
    }

    /** name@example.com -> na**@example.com */
    public static function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $visible = mb_substr($local, 0, min(2, max(1, mb_strlen($local) - 1)));

        return $visible . str_repeat('*', max(2, mb_strlen($local) - mb_strlen($visible))) . '@' . $domain;
    }
}
