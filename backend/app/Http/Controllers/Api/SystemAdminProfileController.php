<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * The logged-in System Administrator's own profile. Routes sit behind the
 * EnsureSystemAdmin middleware. The login ID (school_id) is read-only here.
 */
class SystemAdminProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'profile' => $this->resource($request->user()),
        ]);
    }

    /**
     * Multipart form: name, email (optional), photo (optional file),
     * remove_photo (optional boolean).
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        // The email changes only through the verified "Change Email" steps.
        if ($response = \App\Support\ProfileEmailGuard::refuseChange($request, $user)) {
            return $response;
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'photo' => ['nullable', ...\App\Support\ProfilePhoto::RULES],
            'remove_photo' => ['sometimes', 'boolean'],
        ], \App\Support\ProfilePhoto::messagesFor('photo'));

        $oldPhotoPath = $user->profile_photo_path;
        $before = ['name' => $user->name, 'email' => $user->email];

        $user->name = $validated['name'];

        if ($request->hasFile('photo')) {
            $user->profile_photo_path = \App\Support\ProfilePhoto::store($request->file('photo'));
        } elseif ($request->boolean('remove_photo')) {
            $user->profile_photo_path = null;
        }

        $user->save();

        // Audit only what actually changed (from -> to); photos as a flag.
        $changes = [];
        foreach ($before as $field => $old) {
            if ($old !== $user->{$field}) {
                $changes[$field] = ['from' => $old, 'to' => $user->{$field}];
            }
        }
        if ($user->profile_photo_path !== $oldPhotoPath) {
            $changes['profile_photo'] = $user->profile_photo_path ? ['changed' => true] : ['removed' => true];
        }
        if ($changes !== []) {
            AuditLogger::log('update', AuditLogger::OWN_ACCOUNT, [
                'actor' => $user,
                'target' => $user,
                'old' => array_map(fn ($change) => $change['from'] ?? null, $changes),
                'new' => array_map(fn ($change) => $change['to'] ?? ($change['removed'] ?? false ? 'removed' : 'changed'), $changes),
                'details' => 'Updated own profile: ' . implode(', ', array_map(fn ($field) => str_replace('_', ' ', $field), array_keys($changes))),
                'request' => $request,
            ]);
        }

        if (
            $oldPhotoPath
            && $oldPhotoPath !== $user->profile_photo_path
            && str_starts_with($oldPhotoPath, 'profile-photos/')
        ) {
            Storage::disk('public')->delete($oldPhotoPath);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profile updated.',
            'profile' => $this->resource($user),
        ]);
    }

    private function resource(User $user): array
    {
        return [
            'name' => $user->name,
            'email' => $user->email,
            'school_id' => $user->school_id,
            'role' => $user->role,
            'profile_photo_url' => $user->profile_photo_path
                ? url(Storage::disk('public')->url($user->profile_photo_path))
                : null,
        ];
    }
}
