<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLogEntry;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\Backup\BackupManager;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;

class SystemAdminController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $statistics = [
            'total_users' => 0,
            'learners' => 0,
            'instructors' => 0,
            'academic_admins' => 0,
            'system_admins' => 0,
            'active_accounts' => 0,
            'inactive_accounts' => 0,
        ];

        $usersByRoleAndStatus = User::query()
            ->selectRaw('role, is_active, COUNT(*) as aggregate')
            ->groupBy('role', 'is_active')
            ->get();

        foreach ($usersByRoleAndStatus as $group) {
            $count = (int) $group->aggregate;
            $statistics['total_users'] += $count;
            $statistics[$group->is_active ? 'active_accounts' : 'inactive_accounts'] += $count;

            $roleStatistic = match ($group->role) {
                'learner' => 'learners',
                'instructor' => 'instructors',
                'academic_admin' => 'academic_admins',
                'system_admin' => 'system_admins',
                default => null,
            };

            if ($roleStatistic !== null) {
                $statistics[$roleStatistic] += $count;
            }
        }

        // The newest audit log entries, for "Recent System Activity".
        $recentActivity = AuditLogEntry::query()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(5)
            ->get()
            ->map(fn (AuditLogEntry $entry) => [
                'id' => $entry->id,
                'created_at_manila' => $entry->created_at?->timezone('Asia/Manila')->format('M j, Y, g:i A'),
                'actor_name' => $entry->actor_name,
                'actor_role' => $entry->actor_role,
                'action_label' => AuditLogger::label($entry->action),
                'details' => $entry->details,
                'module' => $entry->module,
                'result' => $entry->result,
            ])
            ->values();

        return response()->json([
            'success' => true,
            'statistics' => $statistics,
            'recent_activity' => $recentActivity,
            'attention' => $this->attention($statistics),
        ]);
    }

    private const FAILED_SIGN_IN_ALERT = 10;   // failed sign-ins in 24 hours
    private const BACKUP_MAX_AGE_DAYS = 7;

    /**
     * Things the System Admin should act on, from the audit log, the saved
     * backups and the accounts. Each item: level (danger, warning or
     * success), icon, title, text and a link to the page that fixes it.
     */
    private function attention(array $statistics): array
    {
        $items = [];
        $dayAgo = now()->subDay();
        $weekAgo = now()->subDays(self::BACKUP_MAX_AGE_DAYS);
        $auditLink = fn (array $filters) => 'audit-logs.html?' . http_build_query($filters);
        $fromDate = fn (Carbon $time) => $time->copy()->timezone('Asia/Manila')->format('Y-m-d');

        // No active Academic Admin: nobody can manage classes or accounts.
        $activeAcademicAdmins = User::query()->where('role', 'academic_admin')->where('is_active', true)->count();
        if ($activeAcademicAdmins === 0) {
            $items[] = [
                'level' => 'danger',
                'icon' => 'user-round-x',
                'title' => 'No active Academic Admin',
                'text' => $statistics['academic_admins'] > 0
                    ? 'Every Academic Admin account is deactivated. Activate one so classes and accounts can be managed.'
                    : 'There is no Academic Admin account yet. Create one so classes and accounts can be managed.',
                'link' => 'administrators.html',
                'link_label' => 'Academic Administrators',
            ];
        }

        // Backups or restores that failed this week.
        $failedBackups = AuditLogEntry::query()
            ->whereIn('action', ['backup_failed', 'backup_restore_failed'])
            ->where('created_at', '>=', $weekAgo)
            ->count();
        if ($failedBackups > 0) {
            $items[] = [
                'level' => 'danger',
                'icon' => 'database',
                'title' => $failedBackups === 1 ? '1 backup or restore failed' : "{$failedBackups} backups or restores failed",
                'text' => 'In the last ' . self::BACKUP_MAX_AGE_DAYS . ' days. See the audit log for the reason.',
                'link' => $auditLink(['module' => AuditLogger::BACKUP, 'result' => 'failed', 'from' => $fromDate($weekAgo)]),
                'link_label' => 'View in Audit Logs',
            ];
        }

        // Accounts locked after repeated wrong passwords.
        $locked = AuditLogEntry::query()
            ->where('action', 'account_locked')
            ->where('created_at', '>=', $dayAgo)
            ->orderByDesc('created_at')
            ->pluck('target_id')
            ->filter()
            ->unique()
            ->values();
        if ($locked->isNotEmpty()) {
            $shown = $locked->take(3)->implode(', ') . ($locked->count() > 3 ? ' and ' . ($locked->count() - 3) . ' more' : '');
            $items[] = [
                'level' => 'warning',
                'icon' => 'lock',
                'title' => $locked->count() === 1 ? '1 account locked' : "{$locked->count()} accounts locked",
                'text' => "Too many wrong passwords in the last 24 hours: {$shown}.",
                'link' => $auditLink(['action' => 'account_locked', 'from' => $fromDate($dayAgo)]),
                'link_label' => 'View in Audit Logs',
            ];
        }

        // Many failed sign-ins may mean someone is guessing passwords.
        $failedSignIns = AuditLogEntry::query()
            ->where('action', 'sign_in_failed')
            ->where('created_at', '>=', $dayAgo)
            ->count();
        if ($failedSignIns >= self::FAILED_SIGN_IN_ALERT) {
            $items[] = [
                'level' => 'warning',
                'icon' => 'shield-alert',
                'title' => "{$failedSignIns} failed sign-ins",
                'text' => 'In the last 24 hours. This many can mean someone is guessing passwords.',
                'link' => $auditLink(['action' => 'sign_in_failed', 'from' => $fromDate($dayAgo)]),
                'link_label' => 'View in Audit Logs',
            ];
        }

        // Last backup made on this server (uploaded copies are not counted).
        $lastBackup = collect(app(BackupManager::class)->list())
            ->reject(fn (array $backup) => $backup['uploaded'])
            ->map(fn (array $backup) => Carbon::parse($backup['created_at']))
            ->sortDesc()
            ->first();
        $backupItem = ['icon' => 'database-backup', 'link' => 'backup.html', 'link_label' => 'Data Backup'];
        if ($lastBackup === null) {
            $items[] = $backupItem + [
                'level' => 'warning',
                'title' => 'No backup yet',
                'text' => 'Make a backup so the data can be restored if something goes wrong.',
            ];
        } elseif ($lastBackup->lt($weekAgo)) {
            $items[] = $backupItem + [
                'level' => 'warning',
                'title' => 'Backup is ' . (int) $lastBackup->diffInDays(now()) . ' days old',
                'text' => 'Last backup: ' . $lastBackup->copy()->timezone('Asia/Manila')->format('M j, Y, g:i A') . '. Make a new one.',
            ];
        } else {
            $items[] = $backupItem + [
                'level' => 'success',
                'title' => 'Backup is up to date',
                'text' => 'Last backup: ' . $lastBackup->copy()->timezone('Asia/Manila')->format('M j, Y, g:i A') . '.',
            ];
        }

        if (!collect($items)->contains(fn (array $item) => $item['level'] !== 'success')) {
            $items[] = [
                'level' => 'success',
                'icon' => 'shield-check',
                'title' => 'All clear',
                'text' => 'No locked accounts or unusual failed sign-ins in the last 24 hours.',
                'link' => 'audit-logs.html',
                'link_label' => 'Audit Logs',
            ];
        }

        return $items;
    }
}
