<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Accounts still on an admin-chosen password can only set a new password
 * or log out. After that, an account without an email can only add its
 * email or log out. Everything else is refused until setup is complete.
 */
class EnsurePasswordSetupComplete
{
    private const ALLOWED_PATHS = [
        'api/logout',
        'api/student/setup-password',
        'api/instructor/setup-password',
        'api/admin/setup-password',
    ];

    private const EMAIL_STEP_PATHS = [
        'api/logout',
        'api/account/email',
        'api/account/email/verify',
        'api/account/email/resend',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (
            $user
            && !$user->password_setup_complete
            && !in_array($request->path(), self::ALLOWED_PATHS, true)
        ) {
            return response()->json([
                'success' => false,
                'code' => 'password_setup_required',
                'message' => 'Please set a new password before continuing.',
            ], 403);
        }

        if (
            $user
            && $user->needsEmail()
            && !in_array($request->path(), self::EMAIL_STEP_PATHS, true)
        ) {
            return response()->json([
                'success' => false,
                'code' => 'email_required',
                'message' => 'Please add and confirm your email address before continuing.',
            ], 403);
        }

        return $next($request);
    }
}
