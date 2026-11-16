<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\AuditLogger;
use App\Support\PasswordPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class PasswordController extends Controller
{
    // Student password setup
    public function setup(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'learner') {
            return response()->json([
                'success' => false,
                'message' => 'This endpoint is for students only.',
            ], 403);
        }

        return $this->completeSetup($request);
    }

    // Instructor password setup
    public function setupInstructor(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'instructor') {
            return response()->json([
                'success' => false,
                'message' => 'This endpoint is for instructors only.',
            ], 403);
        }

        return $this->completeSetup($request);
    }

    public function setupAcademicAdmin(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'academic_admin') {
            return response()->json([
                'success' => false,
                'message' => 'This endpoint is for Academic Administrators only.',
            ], 403);
        }

        return $this->completeSetup($request);
    }

    // Shared password setup logic
    private function completeSetup(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'password' => [...PasswordPolicy::rules($user->role), 'confirmed'],
        ], PasswordPolicy::messages($user->role));

        if ($user->password_setup_complete) {
            return response()->json([
                'success' => false,
                'message' => 'Password setup has already been completed.',
            ], 403);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
            'password_setup_complete' => true,
        ]);

        AuditLogger::log('password_set', AuditLogger::OWN_ACCOUNT, [
            'actor' => $user,
            'target' => $user,
            'details' => 'Replaced the temporary password with their own',
            'request' => $request,
        ]);

        // Issue a replacement token so the user stays logged in.
        $newToken = $user->createToken('auth_token')->plainTextToken;

        // Revoke the temporary login token.
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'success' => true,
            'message' => 'Password setup completed successfully.',
            'token' => $newToken,
        ]);
    }

    // Change password for the authenticated Academic Admin
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || $user->role !== 'academic_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Only Academic Admins can use this endpoint.',
            ], 403);
        }

        return $this->changeOwnPassword($request);
    }

    // Change password for any logged-in user (all roles)
    public function changeOwnPassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => [
                ...PasswordPolicy::rules($user->role),
                'confirmed',
                'different:current_password',
            ],
        ], PasswordPolicy::messages($user->role));

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Your current password is incorrect.',
                'errors' => [
                    'current_password' => [
                        'Your current password is incorrect.',
                    ],
                ],
            ], 422);
        }

        $user->password = Hash::make($validated['password']);
        $user->save();

        // Log out every other session; keep the one making this request
        // (a stored login token; other kinds of login have no id).
        $current = $user->currentAccessToken();
        $currentTokenId = $current instanceof \Laravel\Sanctum\PersonalAccessToken ? $current->id : null;
        $user->tokens()
            ->when($currentTokenId, fn ($query) => $query->whereKeyNot($currentTokenId))
            ->delete();

        AuditLogger::log('password_change', AuditLogger::OWN_ACCOUNT, [
            'actor' => $user,
            'target' => $user,
            'details' => 'Changed their own password',
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully.',
        ]);
    }
}
