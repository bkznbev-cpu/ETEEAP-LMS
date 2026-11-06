<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\User;
use App\Support\Backup\DatabaseDumper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;
use ZipArchive;
use PHPUnit\Framework\Attributes\Group;

/**
 * System Admin Data Backup: one zip with the database, the uploaded
 * files and a restore guide; never the .env file.
 */
#[Group('integration')]
class SystemAdminBackupTest extends TestCase
{
    use RefreshDatabase;

    private string $root;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'skb-test-' . bin2hex(random_bytes(4));
        $private = $this->root . '/private';
        $photos = $this->root . '/public/profile-photos';
        File::ensureDirectoryExists($private . '/submissions/24-0001');
        File::ensureDirectoryExists($private . '/module-materials');
        File::ensureDirectoryExists($photos);
        file_put_contents($private . '/submissions/24-0001/work.pdf', '%PDF-1.4 work');
        file_put_contents($private . '/module-materials/lesson.pdf', '%PDF-1.4 lesson');
        file_put_contents($photos . '/me.png', 'png');
        file_put_contents($private . '/.gitignore', '*');

        config([
            'backup.directory' => $this->root . '/backups',
            'backup.folders' => [
                $private => 'files/private',
                $photos => 'files/public/profile-photos',
            ],
        ]);

        // The tests use SQLite, so the mysqldump step is replaced.
        $this->app->instance(DatabaseDumper::class, new class extends DatabaseDumper {
            public function dump(string $sqlPath): void
            {
                file_put_contents($sqlPath, "-- fake dump\nCREATE TABLE users (id int);\n");
            }
        });

        $this->admin = User::factory()->create(['role' => 'system_admin', 'school_id' => 'SYS-BK-01', 'name' => 'Arcana', 'is_active' => true]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->root);
        parent::tearDown();
    }

    private function make(array $body = [])
    {
        return $this->actingAs($this->admin)->postJson('/api/system-admin/backups', $body);
    }

    private function zipEntries(string $path, ?string $password = null): array
    {
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($path) === true);
        if ($password) {
            $zip->setPassword($password);
        }
        $entries = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $stat = $zip->statIndex($i);
            $entries[$stat['name']] = $stat;
        }
        $zip->close();

        return $entries;
    }

    #[Group('FR-SA'), Group('FR-SA-01')]
    public function test_backup_holds_database_files_and_guide_but_not_env(): void
    {
        $response = $this->make()->assertCreated()->assertJsonPath('backup.encrypted', false);
        $name = $response->json('backup.name');

        $this->assertMatchesRegularExpression('/^siknayan-backup-\d{8}-\d{6}\.zip$/', $name);
        $path = $this->root . '/backups/' . $name;
        $entries = array_keys($this->zipEntries($path));
        sort($entries);

        $this->assertSame([
            'RESTORE.txt',
            'database.sql',
            'files/private/module-materials/lesson.pdf',
            'files/private/submissions/24-0001/work.pdf',
            'files/public/profile-photos/me.png',
            'manifest.json',
        ], $entries);

        $zip = new ZipArchive();
        $zip->open($path);
        $this->assertStringContainsString('CREATE TABLE users', $zip->getFromName('database.sql'));
        $manifest = json_decode($zip->getFromName('manifest.json'), true);
        $zip->close();
        $this->assertSame('Arcana', $manifest['created_by']);
        $this->assertSame(3, $manifest['files']['count']);
        $this->assertSame(1, $manifest['counts']['users']);

        // Listed, and recorded in the Audit Logs.
        $this->actingAs($this->admin)->getJson('/api/system-admin/backups')
            ->assertOk()->assertJsonPath('backups.0.name', $name)->assertJsonPath('backups.0.files.count', 3);
        $log = AuditLogEntry::where('action', 'backup_run')->latest('id')->first();
        $this->assertSame('Data Backup', $log->module);
        $this->assertSame($name, $log->target_id);
        $this->assertSame('success', $log->result);
        $this->actingAs($this->admin)->getJson('/api/system-admin/audit-logs')
            ->assertOk()->assertJsonPath('logs.0.module', 'Data Backup');

        // No temporary database file is left behind.
        $this->assertSame([], glob($this->root . '/backups/.database-*'));
    }

    #[Group('FR-SA'), Group('FR-SA-01')]
    public function test_password_protected_backup_is_aes_encrypted(): void
    {
        $name = $this->make(['password' => 'Keep-this-safe-123', 'password_confirmation' => 'Keep-this-safe-123'])
            ->assertCreated()->assertJsonPath('backup.encrypted', true)->json('backup.name');
        $path = $this->root . '/backups/' . $name;

        foreach ($this->zipEntries($path) as $entry) {
            $this->assertSame(ZipArchive::EM_AES_256, $entry['encryption_method'], $entry['name']);
        }

        $zip = new ZipArchive();
        $zip->open($path);
        $this->assertFalse($zip->getFromName('database.sql'), 'no password: cannot read');
        $zip->setPassword('Keep-this-safe-123');
        $this->assertStringContainsString('fake dump', $zip->getFromName('database.sql'));
        $zip->close();

        // The password is not kept anywhere next to the backup.
        $this->assertStringNotContainsString('Keep-this-safe-123', file_get_contents($path . '.json'));

        $this->make(['password' => 'short', 'password_confirmation' => 'short'])->assertStatus(422);
        $this->make(['password' => 'Long-enough-1', 'password_confirmation' => 'Different-1'])->assertStatus(422);
    }

    #[Group('FR-SA'), Group('FR-SA-01')]
    public function test_download_and_delete(): void
    {
        $name = $this->make()->json('backup.name');

        $this->actingAs($this->admin)->get("/api/system-admin/backups/{$name}/download")
            ->assertOk()->assertHeader('Content-Type', 'application/zip');
        $this->assertSame($name, AuditLogEntry::where('action', 'backup_downloaded')->latest('id')->first()->target_id);

        $this->actingAs($this->admin)->deleteJson("/api/system-admin/backups/{$name}")->assertOk();
        $this->assertFileDoesNotExist($this->root . '/backups/' . $name);
        $this->assertFileDoesNotExist($this->root . '/backups/' . $name . '.json');
        $this->actingAs($this->admin)->deleteJson("/api/system-admin/backups/{$name}")->assertNotFound();
    }

    #[Group('FR-SA'), Group('FR-SA-01')]
    public function test_only_backup_file_names_are_accepted(): void
    {
        file_put_contents($this->root . '/secret.txt', 'x');

        foreach (['..%2Fsecret.txt', 'secret.txt', 'siknayan-backup-1.zip'] as $bad) {
            $this->actingAs($this->admin)->get("/api/system-admin/backups/{$bad}/download")->assertNotFound();
            $this->actingAs($this->admin)->deleteJson("/api/system-admin/backups/{$bad}")->assertNotFound();
        }

        $this->assertFileExists($this->root . '/secret.txt');
    }

    #[Group('FR-SA'), Group('NFR-S'), Group('FR-SA-01'), Group('NFR-S-02')]
    public function test_other_roles_cannot_use_backups(): void
    {
        $name = $this->make()->json('backup.name');

        foreach (['academic_admin', 'instructor', 'learner'] as $index => $role) {
            $user = User::factory()->create(['role' => $role, 'school_id' => "X-BK-{$index}", 'is_active' => true]);
            $this->actingAs($user)->getJson('/api/system-admin/backups')->assertForbidden();
            $this->actingAs($user)->postJson('/api/system-admin/backups')->assertForbidden();
            $this->actingAs($user)->get("/api/system-admin/backups/{$name}/download")->assertForbidden();
            $this->actingAs($user)->deleteJson("/api/system-admin/backups/{$name}")->assertForbidden();
        }
    }
}
