<?php

namespace App\Support;

use App\Models\AuditLogEntry;
use App\Models\Course;
use App\Models\Grade;
use App\Models\Module;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The one place that writes the audit trail (table audit_logs).
 *
 *   AuditLogger::log('update', 'Grades', [
 *       'target'  => $grade,                 // or target_type / target_id / target_label
 *       'old'     => ['score' => 40],
 *       'new'     => ['score' => 45],
 *       'details' => 'Changed the grade of ...',
 *   ]);
 *
 * Options: actor (User|null; default: the signed-in user), actor_name,
 * actor_role, target, target_type, target_id, target_label, old, new,
 * result ('success' | 'failed'), details, request.
 *
 * Never stored: passwords, reset codes, tokens, secrets, or file contents
 * (keys that look like them are removed; long text is cut short).
 * Logging never breaks the action being logged.
 */
class AuditLogger
{
    // Modules (the page's Module column)
    public const AUTH = 'Authentication';
    public const OWN_ACCOUNT = 'Own Account';
    public const ACADEMIC_ADMINS = 'Academic Admin Accounts';
    public const INSTRUCTORS = 'Instructor Accounts';
    public const LEARNERS = 'Learner Accounts';
    public const CLASSES = 'Classes & Enrollment';
    public const MODULES = 'Modules';
    public const SUBMISSIONS = 'Submissions';
    public const GRADES = 'Grades';
    public const BACKUP = 'Data Backup';
    public const AUDIT = 'Audit Logs';

    /** Keys whose values are never written to the audit trail. */
    private const SECRET_KEY = '/^(.*password.*|passcode|.*token.*|.*secret.*|reset_code|verification_code|otp|.*hash|api_key|file_contents?|contents?)$/i';

    public static function log(string $action, string $module, array $options = []): ?AuditLogEntry
    {
        try {
            $request = $options['request'] ?? (app()->runningInConsole() && !app()->runningUnitTests() ? null : request());
            $actor = array_key_exists('actor', $options) ? $options['actor'] : $request?->user();

            [$targetType, $targetId, $targetLabel] = self::target($options);

            return AuditLogEntry::create([
                'actor_id' => $actor?->id,
                'actor_name' => Str::limit($options['actor_name'] ?? $actor?->name ?? 'Unknown', 250, ''),
                'actor_role' => $options['actor_role'] ?? $actor?->role,
                'action' => $action,
                'module' => $module,
                'target_type' => $targetType,
                'target_id' => $targetId !== null ? Str::limit((string) $targetId, 100, '') : null,
                'target_label' => $targetLabel !== null ? Str::limit((string) $targetLabel, 250, '') : null,
                'old_values' => self::clean($options['old'] ?? null),
                'new_values' => self::clean($options['new'] ?? null),
                'result' => ($options['result'] ?? 'success') === 'failed' ? 'failed' : 'success',
                'ip_address' => $request?->ip(),
                'details' => Str::limit($options['details'] ?? ucfirst(str_replace('_', ' ', $action)), 495),
            ]);
        } catch (\Throwable $error) {
            // The audit trail must never stop the real action.
            report($error);
            return null;
        }
    }

    /** Readable names of actions (Audit Logs page and CSV). */
    public const ACTION_LABELS = [
        'sign_in' => 'Sign-in',
        'sign_in_failed' => 'Failed Sign-in',
        'sign_in_blocked' => 'Sign-in Refused',
        'sign_out' => 'Sign-out',
        'account_locked' => 'Account Locked',
        'reset_code_sent' => 'Reset Code Sent',
        'password_reset' => 'Password Reset',
        'password_set' => 'Password Set',
        'password_change' => 'Password Change',
        'email_added' => 'Email Added',
        'create' => 'Create',
        'update' => 'Update',
        'delete' => 'Delete',
        'activate' => 'Activate',
        'deactivate' => 'Deactivate',
        'reset_password' => 'Temporary Password',
        'import' => 'Import',
        'enroll' => 'Enroll',
        'unenroll' => 'Remove from Class',
        'upload' => 'Upload',
        'replace' => 'Replace File',
        'submit' => 'Submit',
        'unsubmit' => 'Unsubmit',
        'backup_run' => 'Backup Run',
        'backup_failed' => 'Backup Failed',
        'backup_downloaded' => 'Backup Downloaded',
        'backup_deleted' => 'Backup Deleted',
        'backup_restored' => 'Backup Restored',
        'backup_restore_failed' => 'Restore Failed',
        'backup_restore_refused' => 'Restore Refused',
        'backup_uploaded' => 'Backup Uploaded',
        'audit_log_exported' => 'Audit Log Exported',
        'credentials_downloaded' => 'Credentials Downloaded',
    ];

    public static function label(string $action): string
    {
        return self::ACTION_LABELS[$action] ?? ucfirst(str_replace('_', ' ', $action));
    }

    /** "user SYS-001", "grade #142", "class IT 101", ... */
    public static function target(array $options): array
    {
        $target = $options['target'] ?? null;

        if ($target instanceof Model) {
            [$type, $id, $label] = match (true) {
                $target instanceof User => ['user', $target->school_id ?: '#' . $target->id, $target->name],
                $target instanceof Grade => ['grade', '#' . $target->id, null],
                $target instanceof Course => ['class', $target->code ?: '#' . $target->id, $target->name],
                $target instanceof Module => ['module', '#' . $target->id, $target->title],
                $target instanceof Submission => ['submission', '#' . $target->id, $target->file_name],
                default => [Str::snake(class_basename($target)), '#' . $target->getKey(), null],
            };

            return [
                $options['target_type'] ?? $type,
                $options['target_id'] ?? $id,
                $options['target_label'] ?? $label,
            ];
        }

        return [$options['target_type'] ?? null, $options['target_id'] ?? null, $options['target_label'] ?? null];
    }

    /** Only differences between two arrays (for update entries). */
    public static function changes(array $before, array $after): array
    {
        $old = [];
        $new = [];

        foreach ($after as $key => $value) {
            if (($before[$key] ?? null) != $value) {
                $old[$key] = $before[$key] ?? null;
                $new[$key] = $value;
            }
        }

        return [$old, $new];
    }

    private static function clean(?array $values): ?array
    {
        if ($values === null || $values === []) {
            return null;
        }

        $out = [];

        foreach ($values as $key => $value) {
            if (is_string($key) && preg_match(self::SECRET_KEY, $key)) {
                continue;
            }

            if (is_array($value)) {
                $out[$key] = self::clean($value) ?? [];
            } elseif (is_string($value)) {
                $out[$key] = Str::limit($value, 300);
            } elseif (is_scalar($value) || $value === null) {
                $out[$key] = $value;
            }
        }

        return $out ?: null;
    }
}
