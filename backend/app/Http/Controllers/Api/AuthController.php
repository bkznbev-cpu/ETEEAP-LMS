<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\AdminNotifier;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Laravel\Sanctum\TransientToken;

class AuthController extends Controller
{
    // 5 wrong passwords for the same account within 15 minutes lock that
    // account for 15 minutes (from any computer).
    private const MAX_ATTEMPTS_PER_ACCOUNT = 5;
    private const ACCOUNT_WINDOW_SECONDS = 900;

    // Separately, one computer (IP) may try at most 20 times a minute.
    private const MAX_ATTEMPTS_PER_IP = 20;
    private const IP_WINDOW_SECONDS = 60;

    // bcrypt hash of a random string; used only to keep timing constant.
    // Its strength (10) matches BCRYPT_ROUNDS so an unknown ID takes as
    // long to check as a real one.
    private const DUMMY_HASH = '$2y$10$2l60Zr2mtRnbOpydpaGE7uY1jEIevlKyEQNCUYRwThE57.p2FqovS';

    public function login(Request $request): JsonResponse
    {
        // Validate login inputs
        $validated = $request->validate([
            'school_id' => ['required', 'string'],
            'password' => ['required', 'string'],
            'agree_terms' => ['sometimes', 'boolean'],
        ]);

        $typedId = Str::limit(trim($validated['school_id']), 100, '');
        $accountKey = 'login-account:' . Str::lower($typedId);
        $ipKey = 'login-ip:' . $request->ip();

        // Locked account: refuse without checking the password.
        if (RateLimiter::tooManyAttempts($accountKey, self::MAX_ATTEMPTS_PER_ACCOUNT)) {
            $seconds = RateLimiter::availableIn($accountKey);
            $minutes = max(1, (int) ceil($seconds / 60));
            $locked = User::where('school_id', $validated['school_id'])->first();

            AuditLogger::log('sign_in_failed', AuditLogger::AUTH, [
                'actor' => null,
                'actor_name' => 'Unknown',
                'target' => $locked,
                'target_type' => 'user',
                'target_id' => $locked?->school_id ?? $typedId,
                'result' => 'failed',
                'details' => 'Sign-in attempt while the account is locked'
                    . ($locked ? " ({$locked->name}, {$locked->school_id})" : " (ID \"{$typedId}\")"),
                'request' => $request,
            ]);

            return response()->json([
                'success' => false,
                'locked' => true,
                'message' => "This account is temporarily locked after " . self::MAX_ATTEMPTS_PER_ACCOUNT
                    . " failed sign-in attempts. Please try again in {$minutes} minute" . ($minutes === 1 ? '' : 's')
                    . ', or use "Forgot Password?".',
                'retry_after' => $seconds,
            ], 429);
        }

        if (RateLimiter::tooManyAttempts($ipKey, self::MAX_ATTEMPTS_PER_IP)) {
            $seconds = RateLimiter::availableIn($ipKey);

            return response()->json([
                'success' => false,
                'message' => "Too many sign-in attempts from this computer. Please try again in {$seconds} seconds.",
                'retry_after' => $seconds,
            ], 429);
        }

        // Find the account using the school ID
        $user = User::where('school_id', $validated['school_id'])
            ->first();

        // Check the password even when the ID doesn't exist, so response
        // time doesn't reveal which school IDs are registered.
        $passwordValid = Hash::check(
            $validated['password'],
            $user?->password ?? self::DUMMY_HASH
        );

        if (!$user || !$passwordValid) {
            $attempts = RateLimiter::hit($accountKey, self::ACCOUNT_WINDOW_SECONDS);
            RateLimiter::hit($ipKey, self::IP_WINDOW_SECONDS);

            // The person trying is unknown, so the actor is "Unknown".
            AuditLogger::log('sign_in_failed', AuditLogger::AUTH, [
                'actor' => null,
                'actor_name' => 'Unknown',
                'target' => $user,
                'target_type' => 'user',
                'target_id' => $user?->school_id ?? $typedId,
                'result' => 'failed',
                'new' => ['attempt' => $attempts],
                'details' => $user
                    ? "Wrong password for {$user->name} ({$user->school_id}), attempt {$attempts} of " . self::MAX_ATTEMPTS_PER_ACCOUNT
                    : "Sign-in attempt with unknown ID \"{$typedId}\"",
                'request' => $request,
            ]);

            // The attempt that reaches the limit locks the account.
            if ($attempts === self::MAX_ATTEMPTS_PER_ACCOUNT) {
                $minutes = intdiv(self::ACCOUNT_WINDOW_SECONDS, 60);

                if ($user) {
                    AdminNotifier::accountLocked($user, self::ACCOUNT_WINDOW_SECONDS);
                }

                AuditLogger::log('account_locked', AuditLogger::AUTH, [
                    'actor' => null,
                    'actor_name' => 'System',
                    'target' => $user,
                    'target_type' => 'user',
                    'target_id' => $user?->school_id ?? $typedId,
                    'new' => ['locked_minutes' => $minutes, 'target_role' => $user?->role],
                    'details' => ($user
                        ? ucfirst(str_replace('_', ' ', (string) $user->role)) . " {$user->name} ({$user->school_id})"
                        : "Unknown ID \"{$typedId}\"")
                        . " locked for {$minutes} minutes after " . self::MAX_ATTEMPTS_PER_ACCOUNT . ' failed sign-ins',
                    'request' => $request,
                ]);

                return response()->json([
                    'success' => false,
                    'locked' => true,
                    'message' => 'This account is now temporarily locked after ' . self::MAX_ATTEMPTS_PER_ACCOUNT
                        . " failed sign-in attempts. Please try again in {$minutes} minutes, or use \"Forgot Password?\".",
                    'retry_after' => self::ACCOUNT_WINDOW_SECONDS,
                ], 429);
            }

            return response()->json([
                'success' => false,
                'message' => 'Invalid ID or password.',
            ], 401);
        }

        RateLimiter::clear($accountKey);

        // Passwords saved with an older, slower hash strength are re-saved
        // at the current strength (BCRYPT_ROUNDS), so later sign-ins are
        // faster. The password itself does not change.
        if (Hash::needsRehash($user->password)) {
            $user->forceFill(['password' => Hash::make($validated['password'])])->saveQuietly();
        }

        if (!$user->is_active) {
            AuditLogger::log('sign_in_blocked', AuditLogger::AUTH, [
                'actor' => $user,
                'target' => $user,
                'result' => 'failed',
                'details' => 'Sign-in refused: the account is deactivated',
                'request' => $request,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'This account is deactivated. Please contact your administrator.',
            ], 403);
        }

        // First login (temporary password): the Terms of Service must be
        // accepted. Later logins don't ask again.
        if (!$user->password_setup_complete && !$request->boolean('agree_terms')) {
            return response()->json([
                'success' => false,
                'terms_required' => true,
                'message' => 'Please agree to the Terms of Service to continue.',
            ], 422);
        }

        // Create an authentication token
        $token = $user->createToken('siknayan-login')->plainTextToken;

        AuditLogger::log('sign_in', AuditLogger::AUTH, [
            'actor' => $user,
            'target' => $user,
            'details' => $user->password_setup_complete ? 'Signed in' : 'Signed in with a temporary password',
            'request' => $request,
        ]);

        // Return login information
        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'token' => $token,
            'first_login' => !$user->password_setup_complete,
            // Password already set but no email yet: add it first.
            'email_required' => $user->needsEmail(),

            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'school_id' => $user->school_id,
                'program' => $user->program,
                'contact' => $user->contact,
                'role' => $user->role,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $currentAccessToken = $request->user()->currentAccessToken();

        if ($currentAccessToken instanceof TransientToken) {
            Auth::guard('web')->logout();

            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
        } else {
            $currentAccessToken?->delete();
        }

        AuditLogger::log('sign_out', AuditLogger::AUTH, [
            'target' => $request->user(),
            'details' => 'Signed out',
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }
}
