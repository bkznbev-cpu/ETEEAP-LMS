<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\AdminNotifier;
use App\Support\AuditLogger;
use App\Rules\EmailDomainExists;
use App\Rules\UniqueEmail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class SystemAdminAcademicAdminController extends Controller
{
    public function index(): JsonResponse
    {
        $administrators = User::query()
            ->where('role', 'academic_admin')
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'email',
                'school_id',
                'role',
                'is_active',
                'password_setup_complete',
                'profile_photo_path',
                'created_at',
                'updated_at',
            ])
            ->map(fn (User $user): array => $this->resource($user));

        return response()->json([
            'success' => true,
            'administrators' => $administrators,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'school_id' => ['required', 'string', 'max:255', Rule::unique('users', 'school_id')],
            'email' => ['nullable', 'email', 'max:255', new EmailDomainExists(), new UniqueEmail()],
            // Leave empty to have the server generate a temporary password.
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'is_active' => ['sometimes', 'boolean'],
            'profile_photo' => ['nullable', 'image', 'mimes:jpeg,png', 'max:2048'],
        ]);

        $generatedPassword = empty($validated['password'])
            ? self::temporaryPassword()
            : null;
        $validated['password'] = $generatedPassword ?? $validated['password'];

        $photoPath = $request->file('profile_photo')?->store('profile-photos', 'public');

        try {
            $administrator = DB::transaction(function () use (
                $request,
                $validated,
                $photoPath
            ): User {
                $administrator = User::create([
                    'name' => $validated['name'],
                    'school_id' => $validated['school_id'],
                    'email' => $validated['email'] ?? null,
                    'password' => $validated['password'],
                    'role' => 'academic_admin',
                    'password_setup_complete' => false,
                    'is_active' => $validated['is_active'] ?? true,
                    'profile_photo_path' => $photoPath,
                ]);

                $this->recordAudit(
                    $request->user(),
                    'create',
                    $administrator,
                    [
                        'school_id' => $administrator->school_id,
                        'name' => $administrator->name,
                        'email' => $administrator->email,
                        'is_active' => $administrator->is_active,
                    ]
                );

                AdminNotifier::academicAdminAccountChanged('create', $administrator, $request->user());

                return $administrator;
            });
        } catch (Throwable $error) {
            if ($photoPath) {
                Storage::disk('public')->delete($photoPath);
            }

            throw $error;
        }

        return response()->json(array_filter([
            'success' => true,
            'administrator' => $this->resource($administrator),
            // Returned once, only when the server generated it.
            'temporary_password' => $generatedPassword,
        ], fn ($value) => $value !== null), Response::HTTP_CREATED);
    }

    /**
     * Give an Academic Admin a new temporary password (for a forgotten
     * password). They are logged out everywhere and must choose their own
     * password at next login. The password is returned once and not stored
     * anywhere readable.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $administrator = $this->findAcademicAdmin($id);
        $temporaryPassword = self::temporaryPassword();

        DB::transaction(function () use ($request, $administrator, $temporaryPassword): void {
            $administrator->forceFill([
                'password' => $temporaryPassword,
                'password_setup_complete' => false,
            ])->save();

            $administrator->tokens()->delete();

            $this->recordAudit(
                $request->user(),
                'reset_password',
                $administrator,
                ['school_id' => $administrator->school_id]
            );
        });

        return response()->json([
            'success' => true,
            'administrator' => $this->resource($administrator->fresh()),
            'temporary_password' => $temporaryPassword,
        ]);
    }

    /**
     * 12 characters from letters and digits that are easy to read aloud
     * or copy by hand (no 0/O, 1/l/I).
     */
    private static function temporaryPassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        $password = '';

        for ($i = 0; $i < 12; $i++) {
            $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $password;
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $administrator = $this->findAcademicAdmin($id);
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'school_id' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('users', 'school_id')->ignore($administrator->id),
            ],
            'email' => [
                'sometimes',
                'nullable',
                'email',
                'max:255',
                new EmailDomainExists(), new UniqueEmail($administrator->id),
            ],
            'is_active' => ['sometimes', 'boolean'],
            'remove_profile_photo' => ['sometimes', 'boolean'],
            'profile_photo' => ['nullable', 'image', 'mimes:jpeg,png', 'max:2048'],
        ]);

        if (
            $administrator->is_active
            && array_key_exists('is_active', $validated)
            && !$validated['is_active']
            && $this->activeAcademicAdminCount() <= 1
        ) {
            return $this->lastActiveAdministratorResponse();
        }

        $newPhotoPath = $request->file('profile_photo')?->store(
            'profile-photos',
            'public'
        );
        $oldPhotoPath = $administrator->profile_photo_path;

        try {
            $administrator = DB::transaction(function () use (
                $request,
                $administrator,
                $validated,
                $newPhotoPath,
                $oldPhotoPath
            ): User {
                $changes = [];

                foreach (['name', 'school_id', 'email', 'is_active'] as $field) {
                    if (
                        array_key_exists($field, $validated)
                        && $administrator->{$field} !== $validated[$field]
                    ) {
                        $changes[$field] = [
                            'from' => $administrator->{$field},
                            'to' => $validated[$field],
                        ];
                        $administrator->{$field} = $validated[$field];
                    }
                }

                if ($newPhotoPath) {
                    $administrator->profile_photo_path = $newPhotoPath;
                    $changes['profile_photo'] = ['changed' => true];
                } elseif (
                    ($validated['remove_profile_photo'] ?? false)
                    && $administrator->profile_photo_path
                ) {
                    $administrator->profile_photo_path = null;
                    $changes['profile_photo'] = ['removed' => true];
                }

                if ($changes !== []) {
                    $administrator->save();
                    if (
                        isset($changes['is_active'])
                        && !$administrator->is_active
                    ) {
                        $administrator->tokens()->delete();
                    }

                    $action = isset($changes['is_active'])
                        ? ($administrator->is_active ? 'activate' : 'deactivate')
                        : 'update';

                    $this->recordAudit(
                        $request->user(),
                        $action,
                        $administrator,
                        $changes
                    );

                    AdminNotifier::academicAdminAccountChanged($action, $administrator, $request->user());
                }

                return $administrator;
            });
        } catch (Throwable $error) {
            if ($newPhotoPath) {
                Storage::disk('public')->delete($newPhotoPath);
            }

            throw $error;
        }

        if (
            $oldPhotoPath
            && $oldPhotoPath !== $administrator->profile_photo_path
            && str_starts_with($oldPhotoPath, 'profile-photos/')
        ) {
            Storage::disk('public')->delete($oldPhotoPath);
        }

        return response()->json([
            'success' => true,
            'administrator' => $this->resource($administrator),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $administrator = $this->findAcademicAdmin($id);

        if ($administrator->is($request->user())) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot delete your own account.',
            ], Response::HTTP_CONFLICT);
        }

        if ($administrator->is_active && $this->activeAcademicAdminCount() <= 1) {
            return $this->lastActiveAdministratorResponse();
        }

        // They manage learners, instructors or classes: deleting them would
        // leave those records without an administrator.
        if (
            User::where('owner_admin_id', $administrator->id)->exists()
            || \App\Models\Course::where('owner_admin_id', $administrator->id)->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'This Academic Admin still manages learners, instructors or classes and cannot be deleted. Deactivate the account instead.',
            ], Response::HTTP_CONFLICT);
        }

        if (
            $administrator->courses()->exists()
            || $administrator->instructedCourses()->exists()
            || $administrator->submissions()->exists()
            || $administrator->gradesGiven()->exists()
            || $administrator->progress()->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'This account is linked to learning records and cannot be deleted.',
            ], Response::HTTP_CONFLICT);
        }

        $oldPhotoPath = $administrator->profile_photo_path;

        DB::transaction(function () use ($request, $administrator): void {
            $this->recordAudit(
                $request->user(),
                'delete',
                $administrator,
                [
                    'school_id' => $administrator->school_id,
                    'name' => $administrator->name,
                    'email' => $administrator->email,
                    'is_active' => $administrator->is_active,
                ]
            );
            $administrator->tokens()->delete();
            $administrator->delete();

            AdminNotifier::academicAdminAccountChanged('delete', $administrator, $request->user());
        });

        if ($oldPhotoPath && str_starts_with($oldPhotoPath, 'profile-photos/')) {
            Storage::disk('public')->delete($oldPhotoPath);
        }

        return response()->json([
            'success' => true,
        ]);
    }

    private function findAcademicAdmin(int $id): User
    {
        return User::query()
            ->where('role', 'academic_admin')
            ->findOrFail($id);
    }

    private function activeAcademicAdminCount(): int
    {
        return User::query()
            ->where('role', 'academic_admin')
            ->where('is_active', true)
            ->count();
    }

    private function lastActiveAdministratorResponse(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'At least one active Academic Admin account must remain.',
        ], Response::HTTP_CONFLICT);
    }

    private function resource(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'school_id' => $user->school_id,
            'role' => $user->role,
            'is_active' => $user->is_active,
            'password_setup_complete' => $user->password_setup_complete,
            'profile_photo_url' => $user->profile_photo_path
                ? url(Storage::disk('public')->url($user->profile_photo_path))
                : null,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }

    private function recordAudit(
        User $actor,
        string $action,
        User $target,
        array $details
    ): void {
        $who = "{$target->name} ({$target->school_id})";

        // Updates carry field => [from, to]; create/delete carry a snapshot.
        $isChange = $details !== [] && collect($details)->every(fn ($value) => is_array($value));
        $old = $isChange ? array_map(fn ($c) => $c['from'] ?? null, $details) : ($action === 'delete' ? $details : null);
        $new = $isChange ? array_map(fn ($c) => $c['to'] ?? ($c['removed'] ?? false ? 'removed' : 'changed'), $details) : ($action === 'create' ? $details : null);

        AuditLogger::log($action, AuditLogger::ACADEMIC_ADMINS, [
            'actor' => $actor,
            'target' => $target,
            'old' => $old,
            'new' => $new,
            'details' => match ($action) {
                'create' => "Created Academic Admin account {$who}",
                'delete' => "Deleted Academic Admin account {$who}",
                'activate' => "Activated Academic Admin account {$who}",
                'deactivate' => "Deactivated Academic Admin account {$who}",
                'reset_password' => "Gave Academic Admin account {$who} a new temporary password",
                default => "Updated Academic Admin account {$who}: " . implode(', ', array_map(
                    fn ($field) => str_replace('_', ' ', $field), array_keys($details)
                )),
            },
        ]);
    }
}
