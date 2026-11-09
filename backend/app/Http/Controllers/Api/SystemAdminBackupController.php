<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\AuditLogger;
use App\Support\Backup\BackupManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Data Backup page (System Admin only; see routes/api.php).
 * Every backup made, downloaded or deleted is recorded in the Audit Logs.
 */
class SystemAdminBackupController extends Controller
{
    public function __construct(private BackupManager $backups)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'backups' => $this->backups->list(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // Optional: protects the zip (AES-256). Not stored anywhere.
            'password' => ['nullable', 'string', 'min:8', 'max:100', 'confirmed'],
        ], [
            'password.min' => 'The backup password must be at least 8 characters.',
            'password.confirmed' => 'The two backup passwords do not match.',
        ]);

        @set_time_limit((int) config('backup.timeout', 300) + 60);

        try {
            $backup = $this->backups->create($request->user(), $validated['password'] ?? null);
        } catch (\Throwable $error) {
            report($error);

            AuditLogger::log('backup_failed', AuditLogger::BACKUP, [
                'target_type' => 'backup',
                'result' => 'failed',
                'details' => 'A backup could not be made: ' . ($error instanceof \RuntimeException
                    ? $error->getMessage()
                    : 'unexpected error'),
            ]);

            return response()->json([
                'success' => false,
                'message' => $error instanceof \RuntimeException
                    ? $error->getMessage()
                    : 'The backup could not be made. Please try again.',
            ], 500);
        }

        AuditLogger::log('backup_run', AuditLogger::BACKUP, [
            'target_type' => 'backup',
            'target_id' => $backup['name'],
            'new' => [
                'size_bytes' => $backup['size'],
                'password_protected' => $backup['encrypted'],
                'files' => $backup['files']['count'] ?? null,
            ],
            'details' => sprintf(
                'Made a backup of the database and uploaded files (%.1f MB%s)',
                $backup['size'] / 1048576,
                $backup['encrypted'] ? ', password-protected' : ''
            ),
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Backup created.',
            'backup' => $backup,
        ], 201);
    }

    public function download(Request $request, string $name): BinaryFileResponse|JsonResponse
    {
        $path = $this->backups->path($name);

        if (!$path) {
            return response()->json(['success' => false, 'message' => 'Backup not found.'], 404);
        }

        AuditLogger::log('backup_downloaded', AuditLogger::BACKUP, [
            'target_type' => 'backup',
            'target_id' => $name,
            'details' => "Downloaded the backup {$name}",
            'request' => $request,
        ]);

        return response()->download($path, $name, [
            'Content-Type' => 'application/zip',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Restore a saved backup. Replaces all current data, so the System
     * Admin confirms with their own password.
     * A safety backup of the current system is made first. Everyone
     * (including this admin) has to log in again afterwards.
     */
    public function restore(Request $request, string $name): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'max:255'],
            'zip_password' => ['nullable', 'string', 'max:100'],
        ], [
            'password.required' => 'Enter your own password to confirm the restore.',
        ]);

        $admin = $request->user();
        $limitKey = 'backup-restore-password:' . $admin->id;

        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($limitKey, 5)) {
            return response()->json([
                'success' => false,
                'message' => 'Too many wrong passwords. Please try again in a few minutes.',
            ], 429);
        }

        if (!\Illuminate\Support\Facades\Hash::check($validated['password'], $admin->password)) {
            \Illuminate\Support\Facades\RateLimiter::hit($limitKey, 900);

            AuditLogger::log('backup_restore_refused', AuditLogger::BACKUP, [
                'target_type' => 'backup',
                'target_id' => $name,
                'result' => 'failed',
                'details' => "Restore of {$name} refused: wrong password",
                'request' => $request,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Your password is incorrect. Nothing was restored.',
                'errors' => ['password' => ['Your password is incorrect.']],
            ], 422);
        }

        \Illuminate\Support\Facades\RateLimiter::clear($limitKey);

        @set_time_limit((int) config('backup.timeout', 300) * 3 + 120);

        // Who did it, kept before the database (and this account) is replaced.
        $actorName = $admin->name;
        $actorSchoolId = $admin->school_id;

        try {
            $result = $this->backups->restore($admin, $name, $validated['zip_password'] ?? null);
        } catch (\Throwable $error) {
            report($error);

            AuditLogger::log('backup_restore_failed', AuditLogger::BACKUP, [
                'actor' => \App\Models\User::where('school_id', $actorSchoolId)->first(),
                'actor_name' => $actorName,
                'target_type' => 'backup',
                'target_id' => $name,
                'result' => 'failed',
                'details' => "Restore of {$name} failed: " . ($error instanceof \RuntimeException ? $error->getMessage() : 'unexpected error'),
                'request' => $request,
            ]);

            return response()->json([
                'success' => false,
                'message' => $error instanceof \RuntimeException
                    ? $error->getMessage()
                    : 'The backup could not be restored. Please try again.',
            ], $error instanceof \RuntimeException && $error->getMessage() === 'Backup not found.' ? 404 : 422);
        }

        // Written into the restored audit trail; the admin is linked only
        // if the same account exists in the restored data.
        AuditLogger::log('backup_restored', AuditLogger::BACKUP, [
            'actor' => \App\Models\User::where('school_id', $actorSchoolId)->first(),
            'actor_name' => $actorName,
            'actor_role' => 'system_admin',
            'target_type' => 'backup',
            'target_id' => $name,
            'new' => [
                'safety_backup' => $result['safety_backup'],
                'backup_made_at' => $result['manifest']['created_at'] ?? null,
                'files' => $result['files'],
            ],
            'details' => "Restored the backup {$name} (made " . ($result['manifest']['created_at'] ?? 'at an unknown time')
                . "). A safety backup of the previous data was saved as {$result['safety_backup']}.",
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => "The backup was restored. A safety backup of the previous data was saved as {$result['safety_backup']}. Everyone has to log in again.",
            'restored' => $result['restored'],
            'safety_backup' => $result['safety_backup'],
            'logged_out' => true,
        ]);
    }

    /** Upload a backup zip (e.g. downloaded earlier or from another server) to the list. */
    public function upload(Request $request): JsonResponse
    {
        // PHP drops a file larger than its limits, so the request arrives without it.
        if (!$request->hasFile('backup') && (int) $request->server('CONTENT_LENGTH') > 0) {
            $limit = ini_get('upload_max_filesize') ?: 'the server limit';
            $message = "The file is larger than this server accepts ({$limit}). "
                . 'Ask the server manager to raise upload_max_filesize and post_max_size in php.ini, '
                . 'or restore it by hand (see "Restore by hand instead").';

            return response()->json([
                'success' => false,
                'message' => $message,
                'errors' => ['backup' => [$message]],
            ], 413);
        }

        $request->validate([
            'backup' => ['required', 'file', 'max:' . (int) config('backup.max_upload_kb', 512000)],
        ], [
            'backup.required' => 'Choose a backup zip file to upload.',
            'backup.uploaded' => 'The file could not be uploaded. It may be larger than the server allows (upload_max_filesize / post_max_size in php.ini).',
            'backup.max' => 'The backup file is too large to upload.',
        ]);

        try {
            $backup = $this->backups->storeUpload($request->file('backup'));
        } catch (\RuntimeException $error) {
            return response()->json([
                'success' => false,
                'message' => $error->getMessage(),
                'errors' => ['backup' => [$error->getMessage()]],
            ], 422);
        }

        AuditLogger::log('backup_uploaded', AuditLogger::BACKUP, [
            'target_type' => 'backup',
            'target_id' => $backup['name'],
            'new' => ['size_bytes' => $backup['size'], 'password_protected' => $backup['encrypted']],
            'details' => "Uploaded a backup file (saved as {$backup['name']})",
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Backup uploaded. You can restore it from the list.',
            'backup' => $backup,
        ], 201);
    }

    public function destroy(Request $request, string $name): JsonResponse
    {
        if (!$this->backups->delete($name)) {
            return response()->json(['success' => false, 'message' => 'Backup not found.'], 404);
        }

        AuditLogger::log('backup_deleted', AuditLogger::BACKUP, [
            'target_type' => 'backup',
            'target_id' => $name,
            'details' => "Deleted the backup {$name}",
            'request' => $request,
        ]);

        return response()->json(['success' => true, 'message' => 'Backup deleted.']);
    }
}
