<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * Dashboard "Attention" panel: built from the audit log, the saved
 * backups and the accounts (no sample data).
 */
#[Group('integration')]
class SystemAdminDashboardAttentionTest extends TestCase
{
    use RefreshDatabase;

    private string $backups;

    protected function setUp(): void
    {
        parent::setUp();

        $this->backups = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'skb-attention-' . bin2hex(random_bytes(4));
        File::ensureDirectoryExists($this->backups);
        config(['backup.directory' => $this->backups]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->backups);
        parent::tearDown();
    }

    private function attention(): array
    {
        $admin = User::factory()->create(['school_id' => 'SYS-ATT-01', 'role' => 'system_admin', 'is_active' => true]);

        return $this->withToken($admin->createToken('t')->plainTextToken)
            ->getJson('/api/system-admin/dashboard')
            ->assertOk()
            ->json('attention');
    }

    private function log(string $action, array $values = []): void
    {
        (new AuditLogEntry())->forceFill($values + [
            'actor_name' => 'Unknown',
            'action' => $action,
            'module' => AuditLogger::AUTH,
            'result' => 'failed',
            'details' => 'x',
            'created_at' => now()->subHour(),
        ])->save();
    }

    private function backup(string $createdAt): void
    {
        $name = 'siknayan-backup-' . date('Ymd-His', strtotime($createdAt)) . '.zip';
        file_put_contents($this->backups . DIRECTORY_SEPARATOR . $name, 'zip');
        file_put_contents($this->backups . DIRECTORY_SEPARATOR . $name . '.json', json_encode(['created_at' => $createdAt]));
    }

    #[Group('FR-SA'), Group('FR-SA-04')]
    public function test_all_clear_when_backup_is_recent_and_nothing_is_wrong(): void
    {
        User::factory()->create(['school_id' => 'ADM-ATT-01', 'role' => 'academic_admin', 'is_active' => true]);
        $this->backup(now()->subDay()->toIso8601String());

        $titles = array_column($this->attention(), 'title');

        $this->assertSame(['Backup is up to date', 'All clear'], $titles);
    }

    #[Group('FR-SA'), Group('FR-SA-04')]
    public function test_problems_are_listed_with_links(): void
    {
        // Every Academic Admin deactivated; no backup; a failed backup;
        // two locked accounts; 10 failed sign-ins (and an old one ignored).
        User::factory()->create(['school_id' => 'ADM-ATT-02', 'role' => 'academic_admin', 'is_active' => false]);
        $this->log('backup_failed', ['module' => AuditLogger::BACKUP]);
        $this->log('account_locked', ['target_id' => 'LRN-001']);
        $this->log('account_locked', ['target_id' => 'INS-002']);
        foreach (range(1, 10) as $i) {
            $this->log('sign_in_failed');
        }
        $this->log('sign_in_failed', ['created_at' => now()->subDays(2)]);

        $items = collect($this->attention())->keyBy('title');

        $this->assertSame('danger', $items['No active Academic Admin']['level']);
        $this->assertSame('administrators.html', $items['No active Academic Admin']['link']);
        $this->assertSame('danger', $items['1 backup or restore failed']['level']);
        $this->assertStringContainsString('result=failed', $items['1 backup or restore failed']['link']);
        $this->assertStringContainsString('LRN-001', $items['2 accounts locked']['text']);
        $this->assertStringContainsString('action=account_locked', $items['2 accounts locked']['link']);
        $this->assertSame('warning', $items['10 failed sign-ins']['level']);
        $this->assertSame('warning', $items['No backup yet']['level']);
        $this->assertFalse($items->has('All clear'));
    }

    #[Group('FR-SA'), Group('FR-SA-04')]
    public function test_old_backup_and_few_failed_sign_ins(): void
    {
        User::factory()->create(['school_id' => 'ADM-ATT-03', 'role' => 'academic_admin', 'is_active' => true]);
        $this->backup(now()->subDays(9)->toIso8601String());
        foreach (range(1, 3) as $i) {
            $this->log('sign_in_failed');
        }

        $titles = array_column($this->attention(), 'title');

        $this->assertSame(['Backup is 9 days old'], $titles);
    }
}
