<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * Audit Logs page API: System Admin only, read only, filtered and paged
 * by the server, CSV export (which is logged itself).
 */
#[Group('integration')]
class SystemAdminAuditLogTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $schoolId, ?string $name = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'school_id' => $schoolId,
            'name' => $name ?? "{$role} {$schoolId}",
            'is_active' => true,
        ]);
    }

    private function entry(array $values): AuditLogEntry
    {
        // forceFill: the test sets created_at itself (callers never do).
        $entry = (new AuditLogEntry())->forceFill($values + [
            'actor_name' => 'Unknown',
            'action' => 'sign_in',
            'module' => AuditLogger::AUTH,
            'result' => 'success',
            'details' => 'x',
        ]);
        $entry->save();

        return $entry;
    }

    #[Group('FR-SA'), Group('FR-SA-04')]
    public function test_system_admin_sees_entries_newest_first_with_all_fields(): void
    {
        $systemAdmin = $this->user('system_admin', 'SYS-AL-01');
        $this->user('academic_admin', 'ADM-AL-00'); // keeps one active admin

        $this->actingAs($systemAdmin)
            ->postJson('/api/system-admin/academic-administrators', [
                'name' => 'Audit Target',
                'school_id' => 'ADM-AL-01',
                'password' => 'initial-password',
                'password_confirmation' => 'initial-password',
            ])
            ->assertCreated();

        $targetId = User::where('school_id', 'ADM-AL-01')->value('id');

        $this->actingAs($systemAdmin)
            ->putJson("/api/system-admin/academic-administrators/{$targetId}", ['is_active' => false])
            ->assertOk();

        $response = $this->actingAs($systemAdmin)
            ->getJson('/api/system-admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'logs')
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonPath('timezone', 'Asia/Manila');

        $response->assertJsonPath('logs.0.action', 'deactivate')
            ->assertJsonPath('logs.0.action_label', 'Deactivate')
            ->assertJsonPath('logs.0.module', 'Academic Admin Accounts')
            ->assertJsonPath('logs.0.target', 'user ADM-AL-01 — Audit Target')
            ->assertJsonPath('logs.0.actor_name', $systemAdmin->name)
            ->assertJsonPath('logs.0.actor_role', 'system_admin')
            ->assertJsonPath('logs.0.result', 'success')
            ->assertJsonPath('logs.0.ip_address', '127.0.0.1')
            ->assertJsonPath('logs.0.old_values.is_active', true)
            ->assertJsonPath('logs.0.new_values.is_active', false)
            ->assertJsonPath('logs.1.action', 'create')
            ->assertJsonPath('logs.1.new_values.school_id', 'ADM-AL-01');

        // Stored in UTC, also given in Manila time (UTC+8).
        $this->assertStringEndsWith('Z', $response->json('logs.0.created_at'));
        $this->assertNotNull($response->json('logs.0.created_at_manila'));
    }

    #[Group('FR-SA'), Group('FR-SA-04')]
    public function test_filters_and_pagination(): void
    {
        $admin = $this->user('system_admin', 'SYS-AL-02');
        $learner = $this->user('learner', '24-AL001', 'Ana Cruz');

        // Times in UTC: 2026-10-20 15:30 UTC is 2026-10-20 23:30 in Manila;
        // 2026-10-20 16:30 UTC is already 2026-10-21 00:30 in Manila.
        $this->entry(['created_at' => Carbon::parse('2026-10-20 15:30:00', 'UTC'), 'actor_id' => $learner->id, 'actor_name' => 'Ana Cruz', 'actor_role' => 'learner', 'details' => 'Signed in']);
        $this->entry(['created_at' => Carbon::parse('2026-10-20 16:30:00', 'UTC'), 'action' => 'sign_in_failed', 'result' => 'failed', 'target_id' => '24-AL001', 'details' => 'Wrong password for Ana Cruz']);
        $this->entry(['created_at' => Carbon::parse('2026-10-22 01:00:00', 'UTC'), 'actor_id' => $admin->id, 'actor_name' => $admin->name, 'actor_role' => 'system_admin', 'action' => 'backup_run', 'module' => AuditLogger::BACKUP, 'details' => 'Made a backup']);

        $get = fn (array $query) => $this->actingAs($admin)->getJson('/api/system-admin/audit-logs?' . http_build_query($query))->assertOk();

        $this->assertSame(1, $get(['from' => '2026-10-20', 'to' => '2026-10-20'])->json('pagination.total'));
        $this->assertSame(1, $get(['from' => '2026-10-21', 'to' => '2026-10-21'])->json('pagination.total'));
        $this->assertSame(1, $get(['result' => 'failed'])->json('pagination.total'));
        $this->assertSame('Data Backup', $get(['module' => 'Data Backup'])->json('logs.0.module'));
        $this->assertSame(1, $get(['action' => 'backup_run'])->json('pagination.total'));
        $this->assertSame(1, $get(['actor' => (string) $learner->id])->json('pagination.total'));
        $this->assertSame(1, $get(['actor' => 'unknown'])->json('pagination.total'));
        $this->assertSame(1, $get(['actor_role' => 'learner'])->json('pagination.total'));
        $this->assertSame(1, $get(['q' => 'wrong password'])->json('pagination.total'));
        $this->assertSame(0, $get(['q' => '100%'])->json('pagination.total'));

        // Actors of every role are offered in the filter, not only admins.
        $actors = collect($get([])->json('options.actors'))->pluck('role')->sort()->values()->all();
        $this->assertSame(['learner', 'system_admin'], $actors);

        // Pagination
        for ($i = 0; $i < 30; $i++) {
            $this->entry(['details' => "bulk {$i}"]);
        }
        $page2 = $get(['per_page' => 25, 'page' => 2]);
        $this->assertSame(33, $page2->json('pagination.total'));
        $this->assertSame(2, $page2->json('pagination.last_page'));
        $this->assertCount(8, $page2->json('logs'));

        $this->actingAs($admin)->getJson('/api/system-admin/audit-logs?result=maybe')->assertStatus(422);
        $this->actingAs($admin)->getJson('/api/system-admin/audit-logs?from=2026-10-22&to=2026-10-20')->assertStatus(422);
    }

    #[Group('FR-SA'), Group('FR-SA-05')]
    public function test_export_is_csv_spreadsheet_safe_and_logged(): void
    {
        $admin = $this->user('system_admin', 'SYS-AL-03');
        $this->entry(['details' => '=HYPERLINK("http://evil")', 'actor_name' => '+cmd']);

        $response = $this->actingAs($admin)->get('/api/system-admin/audit-logs/export?result=success');
        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));

        $csv = $response->streamedContent();
        $this->assertStringContainsString('Date & Time (Asia/Manila)', $csv);
        $this->assertStringContainsString("'=HYPERLINK", $csv);
        $this->assertStringContainsString("'+cmd", $csv);

        $export = AuditLogEntry::where('action', 'audit_log_exported')->sole();
        $this->assertSame('Audit Logs', $export->module);
        $this->assertSame($admin->id, $export->actor_id);
        $this->assertSame('success', $export->new_values['result']);
        $this->assertSame(1, $export->new_values['rows']);
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_there_is_no_way_to_change_or_delete_entries(): void
    {
        $admin = $this->user('system_admin', 'SYS-AL-04');
        $entry = $this->entry(['details' => 'keep me']);

        foreach (['put', 'patch', 'delete'] as $method) {
            $status = $this->actingAs($admin)->json($method, "/api/system-admin/audit-logs/{$entry->id}")->status();
            $this->assertContains($status, [404, 405], "{$method} must not exist");
            $status = $this->actingAs($admin)->json($method, '/api/system-admin/audit-logs')->status();
            $this->assertContains($status, [404, 405], "{$method} on the list must not exist");
        }

        $this->assertSame('keep me', $entry->fresh()->details);
    }

    #[Group('FR-SA'), Group('NFR-S'), Group('FR-SA-04'), Group('FR-SA-05'), Group('NFR-S-02')]
    public function test_other_roles_cannot_read_or_export_audit_logs(): void
    {
        foreach (['academic_admin', 'instructor', 'learner'] as $index => $role) {
            $user = $this->user($role, "AL-ROLE-{$index}");
            $this->actingAs($user)->getJson('/api/system-admin/audit-logs')->assertForbidden();
            $this->actingAs($user)->getJson('/api/system-admin/audit-logs/export')->assertForbidden();
        }
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    public function test_audit_logs_require_login(): void
    {
        $this->getJson('/api/system-admin/audit-logs')->assertUnauthorized();
    }
}
