<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Admin deletes need the signed-in admin's own password.
 *
 * The page asks for it in the delete confirmation box and sends it in
 * the X-Confirm-Password header. Without the right password the delete
 * is refused, so the check can't be skipped by calling the API directly.
 */
class DeletePassword
{
    public const HEADER = 'X-Confirm-Password';

    /**
     * Null when the password is right; otherwise the error response.
     */
    public static function check(Request $request, string $action = 'delete'): ?JsonResponse
    {
        $password = (string) $request->header(self::HEADER, '');
        $user = $request->user();

        if ($password === '') {
            return response()->json([
                'success' => false,
                'password_required' => true,
                'message' => "Please enter your password to confirm the {$action}.",
            ], 422);
        }

        if (!$user || !Hash::check($password, $user->password)) {
            return response()->json([
                'success' => false,
                'password_required' => true,
                'message' => $action === 'delete'
                    ? 'Your password is incorrect. Nothing was deleted.'
                    : 'Your password is incorrect.',
            ], 422);
        }

        return null;
    }
}
