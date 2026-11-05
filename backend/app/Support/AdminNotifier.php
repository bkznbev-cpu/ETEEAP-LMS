<?php

namespace App\Support;

use App\Models\Notification;
use App\Models\User;

/**
 * Creates notifications for administrators.
 *
 * Academic Admins hear about grading and locked accounts; System
 * Admins hear about Academic Admin accounts. Every active account with the
 * role gets its own copy, so each admin can mark it read independently.
 */
class AdminNotifier
{
    // Notification "type" values the admin pages group by.
    public const TYPE_GRADE = 'grade';
    public const TYPE_ACCOUNT_LOCKED = 'account_locked';
    public const TYPE_ADMIN_ACCOUNT = 'admin_account';

    private const ROLE_LABELS = [
        'learner' => 'Learner',
        'instructor' => 'Instructor',
        'academic_admin' => 'Academic Admin',
        'system_admin' => 'System Admin',
    ];

    public static function submissionGraded(
        User $instructor,
        User $learner,
        string $moduleTitle,
        string $courseName,
        float|int|string $score,
        float|int|string $maxScore
    ): void {
        self::notifyRole(
            'academic_admin',
            'Activity Graded',
            "{$instructor->name} graded {$learner->name}'s \"{$moduleTitle}\" in {$courseName}: "
                . self::number($score) . '/' . self::number($maxScore) . '.',
            self::TYPE_GRADE
        );
    }

    public static function accountLocked(User $user, int $seconds): void
    {
        $recipientRole = match ($user->role) {
            'learner', 'instructor' => 'academic_admin',
            'academic_admin' => 'system_admin',
            default => null,
        };

        if ($recipientRole === null) {
            return;
        }

        self::notifyRole(
            $recipientRole,
            'Account Locked',
            self::describe($user) . " was locked for {$seconds} seconds after too many failed login attempts.",
            self::TYPE_ACCOUNT_LOCKED
        );
    }

    /**
     * $action is create, deactivate or delete (other actions are ignored).
     */
    public static function academicAdminAccountChanged(string $action, User $target, User $actor): void
    {
        $verb = match ($action) {
            'create' => 'created',
            'deactivate' => 'deactivated',
            'delete' => 'deleted',
            default => null,
        };

        if ($verb === null) {
            return;
        }

        self::notifyRole(
            'system_admin',
            'Academic Admin Account ' . ucfirst($verb),
            "{$actor->name} {$verb} the Academic Admin account {$target->name} ({$target->school_id}).",
            self::TYPE_ADMIN_ACCOUNT
        );
    }

    /**
     * Notifies every active account with the role.
     */
    private static function notifyRole(
        string $role,
        string $title,
        string $message,
        string $type
    ): void {
        $recipients = User::query()
            ->where('role', $role)
            ->where('is_active', true);

        $recipientIds = $recipients->pluck('id');

        $now = now();

        $rows = $recipientIds->map(fn ($id): array => [
            'user_id' => $id,
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'is_read' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        if ($rows !== []) {
            Notification::insert($rows);
        }
    }

    private static function describe(User $user): string
    {
        $role = self::ROLE_LABELS[$user->role] ?? 'User';

        return "{$role} {$user->name} ({$user->school_id})";
    }

    private static function number(float|int|string $value): string
    {
        $number = (float) $value;

        return floor($number) === $number
            ? (string) (int) $number
            : rtrim(rtrim(number_format($number, 2, '.', ''), '0'), '.');
    }
}
