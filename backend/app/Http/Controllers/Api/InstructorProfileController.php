<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class InstructorProfileController extends Controller
{
    /**
     * Get the logged-in instructor's profile.
     */
    public function show(Request $request): JsonResponse
    {
        $instructor = $request->user();

        if (!$instructor || $instructor->role !== 'instructor') {
            return response()->json([
                'success' => false,
                'message' => 'Only instructors can view this profile.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'user' => $this->profile($instructor->fresh()),
        ]);
    }

    /**
     * Update the logged-in instructor's profile.
     */
    public function update(Request $request): JsonResponse
    {
        $instructor = $request->user();

        if (!$instructor || $instructor->role !== 'instructor') {
            return response()->json([
                'success' => false,
                'message' => 'Only instructors can update this profile.',
            ], 403);
        }

        // The email changes only through the verified "Change Email" steps.
        if ($response = \App\Support\ProfileEmailGuard::refuseChange($request, $instructor)) {
            return $response;
        }

        $validated = $request->validate([
            // Optional: the profile pop-up only edits the contact number,
            // like the learner's (the name is managed by the admin).
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'contact' => [
                'nullable',
                'string',
                'max:30',
            ],
        ]);

        $instructor->update([
            'name' => $validated['name'] ?? $instructor->name,
            'contact' => $validated['contact'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'user' => $this->profile($instructor->fresh()),
        ]);
    }

    /**
     * Change the logged-in instructor's password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $instructor = $request->user();

        if (!$instructor || $instructor->role !== 'instructor') {
            return response()->json([
                'success' => false,
                'message' => 'Only instructors can change their password.',
            ], 403);
        }

        $validated = $request->validate([
            'current_password' => [
                'required',
                'string',
            ],

            'new_password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
            ],
        ]);

        if (!Hash::check(
            $validated['current_password'],
            $instructor->password
        )) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect.',
            ], 422);
        }

        $instructor->update([
            'password' => $validated['new_password'],
        ]);

        // Log out every other session; keep the one making this request
        // (a stored login token; other kinds of login have no id).
        $current = $instructor->currentAccessToken();
        $currentTokenId = $current instanceof \Laravel\Sanctum\PersonalAccessToken ? $current->id : null;
        $instructor->tokens()
            ->when($currentTokenId, fn ($query) => $query->whereKeyNot($currentTokenId))
            ->delete();

        \App\Support\AuditLogger::log('password_change', \App\Support\AuditLogger::OWN_ACCOUNT, [
            'target' => $instructor,
            'details' => 'Changed their own password',
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully.',
        ]);
    }

    /**
     * Upload or replace the profile picture (JPG, PNG or WEBP, any size up
     * to 25 MB; stored shrunk, see App\Support\ProfilePhoto).
     */
    public function uploadPhoto(Request $request): JsonResponse
    {
        $instructor = $request->user();

        if (!$instructor || $instructor->role !== 'instructor') {
            return response()->json([
                'success' => false,
                'message' => 'Only instructors can change this profile picture.',
            ], 403);
        }

        $request->validate([
            'photo' => ['required', ...\App\Support\ProfilePhoto::RULES],
        ], \App\Support\ProfilePhoto::messagesFor('photo'));

        $oldPath = $instructor->profile_photo_path;

        $instructor->profile_photo_path = \App\Support\ProfilePhoto::store($request->file('photo'));
        $instructor->save();

        if ($oldPath && str_starts_with($oldPath, 'profile-photos/')) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile picture updated successfully.',
            'user' => $this->profile($instructor->fresh()),
        ]);
    }

    /**
     * What the profile pop-up shows (same fields as the learner's).
     */
    private function profile(User $instructor): array
    {
        return [
            'id' => $instructor->id,
            'name' => $instructor->name,
            'email' => $instructor->email,
            'school_id' => $instructor->school_id,
            'program' => $instructor->program,
            'contact' => $instructor->contact,
            'role' => $instructor->role,
            'profile_photo_url' => $instructor->profile_photo_path
                ? url(Storage::disk('public')->url($instructor->profile_photo_path))
                : null,
            'class_count' => $instructor->instructedCourses()->where('is_active', true)->count(),
            'created_at' => $instructor->created_at,
        ];
    }
}
