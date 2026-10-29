<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * The learner's own profile. Name, school ID and program are managed by
 * the Academic Admin; the learner can update their email and contact
 * number and profile picture. Passwords change through
 * PUT /api/account/password.
 */
class StudentProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'user' => $this->profile($request->user()),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $learner = $request->user();

        // The email changes only through the verified "Change Email" steps.
        if ($response = \App\Support\ProfileEmailGuard::refuseChange($request, $learner)) {
            return $response;
        }

        $validated = $request->validate([
            'contact' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s]*$/'],
        ], [
            'contact.regex' => 'The contact number may only contain numbers, spaces, +, - and brackets.',
        ]);

        $learner->update([
            'contact' => $validated['contact'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'user' => $this->profile($learner->fresh()),
        ]);
    }

    /**
     * Upload or replace the profile picture (JPG, PNG or WEBP, any size up
     * to 25 MB; stored shrunk, see App\Support\ProfilePhoto).
     */
    public function uploadPhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => ['required', ...\App\Support\ProfilePhoto::RULES],
        ], \App\Support\ProfilePhoto::messagesFor('photo'));

        $learner = $request->user();
        $oldPath = $learner->profile_photo_path;

        $learner->profile_photo_path = \App\Support\ProfilePhoto::store($request->file('photo'));
        $learner->save();

        if ($oldPath && str_starts_with($oldPath, 'profile-photos/')) {
            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile picture updated successfully.',
            'user' => $this->profile($learner->fresh()),
        ]);
    }

    private function profile(User $learner): array
    {
        return [
            'id' => $learner->id,
            'name' => $learner->name,
            'school_id' => $learner->school_id,
            'program' => $learner->program,
            'email' => $learner->email,
            'contact' => $learner->contact,
            'role' => $learner->role,
            'profile_photo_url' => $learner->profile_photo_path
                ? url(Storage::disk('public')->url($learner->profile_photo_path))
                : null,
            'class_count' => $learner->courses()->where('is_active', true)->count(),
            'created_at' => $learner->created_at,
        ];
    }
}
