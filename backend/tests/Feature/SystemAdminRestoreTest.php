<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\User;
use App\Support\Backup\DatabaseDumper;
use App\Support\Backup\DatabaseImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;
use ZipArchive;
use PHPUnit\Framework\Attributes\Group;

/**
 * Restore from the Data Backup page: own password + typing RESTORE,
 * a safety backup first, the database and files put back, and the old
 * data put back again if the restore fails.
 */
#[Group('integration')]
class SystemAdminRestoreTest extends TestCase
{
    use RefreshDatabase;

    private string $root;
    private string $private;
    private User $admin;
    /** What the fake importer was asked to import, in order. */
    public static array $imported = [];
    /** How many imports should fail (counted down). */
    public static int $failImports = 0;

    protected function setUp(): void
    {
        parent::setUp();
        self::$imported = [];
        self::$failImports = 0;

        $this->root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'skr-test-' . bin2hex(random_bytes(4));
        $this->private = $this->root . '/private';
        $photos = $this->root . '/public/profile-photos';
        File::ensureDirectoryExists($this->private . '/submissions');
        File::ensureDirectoryExists($photos);
        file_put_contents($this->private . '/submissions/work.pdf', '%PDF-1.4 work');
        file_put_contents($this->private . '/.gitignore', '*');
        file_put_contents($photos . '/me.png', 'png');

        config([
            'backup.directory' => $this->root . '/backups',
            'backup.folders' => [
                $this->private => 'files/private',
                $photos => 'files/public/profile-photos',
            ],
        ]);

        // SQLite in tests: dump and import are replaced.
        $this->app->instance(DatabaseDumper::class, new class extends DatabaseDumper {
            public static int $n = 0;

            public function dump(string $sqlPath): void
            {
                file_put_contents($sqlPath, '-- fake dump ' . (++self::$n) . "\n");
            }
        });

        $this->app->instance(DatabaseImporter::class, new class extends DatabaseImporter {
            public function replaceDatabase(string $sqlPath): void
            {
                SystemAdminRestoreTest::$imported[] = file_get_contents($sqlPath);

                if (SystemAdminRestoreTest::$failImports > 0) {
                    SystemAdminRestoreTest::$failImports--;
                    throw new \RuntimeException('mysql: syntax error');
                }
            }
        });

        $this->admin = User::factory()->create([
            'role' => 'system_admin', 'school_id' => 'SYS-RS-01', 'name' => 'Arcana', 'is_active' => true,
        ]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->root);
        parent::tearDown();
    }

    private function makeBackup(array $body = []): string
    {
        $name = $this->actingAs($this->admin)->postJson('/api/system-admin/backups', $body)
            ->assertCreated()->json('backup.name');

        // Backup names have the time to the second.
        $this->travel(2)->seconds();

        return $name;
    }

    private function restore(string $name, array $body = [])
    {
        return $this->actingAs($this->admin)->postJson(
            "/api/system-admin/backups/{$name}/restore",
            array_merge(['password' => 'password', 'confirm' => 'RESTORE'], $body)
        );
    }

    #[Group('FR-SA'), Group('NFR-R'), Group('FR-SA-02'), Group('NFR-R-01')]
    public function test_restore_puts_back_the_database_and_files_after_a_safety_backup(): void
    {
        $name = $this->makeBackup();

        // Things change after the backup.
        unlink($this->private . '/submissions/work.pdf');
        file_put_contents($this->private . '/submissions/new.pdf', 'added later');

        $response = $this->restore($name)
            ->assertOk()
            ->assertJsonPath('restored', $name)
            ->assertJsonPath('logged_out', true);

        // The backup's database was imported.
        $zip = new ZipArchive();
        $zip->open($this->root . '/backups/' . $name);
        $this->assertSame([$zip->getFromName('database.sql')], self::$imported);
        $zip->close();

        // Files are as they were in the backup; .gitignore is kept.
        $this->assertFileExists($this->private . '/submissions/work.pdf');
        $this->assertFileDoesNotExist($this->private . '/submissions/new.pdf');
        $this->assertFileExists($this->private . '/.gitignore');

        // A safety backup of the changed system was made first (it has new.pdf).
        $safety = $response->json('safety_backup');
        $this->assertNotSame($name, $safety);
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($this->root . '/backups/' . $safety) === true);
        $this->assertNotFalse($zip->locateName('files/private/submissions/new.pdf'));
        $zip->close();

        $log = AuditLogEntry::where('action', 'backup_restored')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame('Arcana', $log->actor_name);
        $this->assertStringContainsString($safety, $log->details);
    }

    #[Group('FR-SA'), Group('NFR-U'), Group('FR-SA-02'), Group('NFR-U-02')]
    public function test_restore_needs_the_admin_password_and_typing_restore(): void
    {
        $name = $this->makeBackup();

        $this->restore($name, ['confirm' => 'restore please'])->assertStatus(422)->assertJsonValidationErrors('confirm');
        $this->restore($name, ['confirm' => ''])->assertStatus(422);
        $this->restore($name, ['password' => 'wrong-password'])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->assertSame([], self::$imported);
        $this->assertDatabaseHas('audit_logs', ['action' => 'backup_restore_refused']);

        // Five wrong passwords stop further tries.
        for ($i = 0; $i < 4; $i++) {
            $this->restore($name, ['password' => 'wrong-password']);
        }
        $this->restore($name)->assertStatus(429);
        $this->assertSame([], self::$imported);
    }

    #[Group('FR-SA'), Group('FR-SA-01'), Group('FR-SA-02')]
    public function test_password_protected_backups_need_their_backup_password(): void
    {
        $name = $this->makeBackup(['password' => 'zip-secret-1', 'password_confirmation' => 'zip-secret-1']);

        $this->restore($name)->assertStatus(422)
            ->assertJsonPath('message', 'This backup is password-protected. Enter the backup password that was used when it was made.');
        $this->restore($name, ['zip_password' => 'not-it'])->assertStatus(422)
            ->assertJsonPath('message', 'The backup password is incorrect.');
        $this->assertSame([], self::$imported);

        $this->restore($name, ['zip_password' => 'zip-secret-1'])->assertOk();
        $this->assertCount(1, self::$imported);
    }

    #[Group('FR-SA'), Group('NFR-R'), Group('FR-SA-02'), Group('NFR-R-01')]
    public function test_a_failed_restore_puts_the_previous_database_back(): void
    {
        $name = $this->makeBackup();
        file_put_contents($this->private . '/submissions/new.pdf', 'added later');

        self::$failImports = 1;

        $this->restore($name)
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        // 1st import (the backup) failed, 2nd put the safety backup's database back.
        $sqlIn = function (string $zipName) {
            $zip = new ZipArchive();
            $zip->open($this->root . '/backups/' . $zipName);
            $sql = $zip->getFromName('database.sql');
            $zip->close();

            return $sql;
        };
        $safety = collect(glob($this->root . '/backups/*.zip'))->map(fn ($p) => basename($p))->reject(fn ($n) => $n === $name)->first();

        $this->assertCount(2, self::$imported);
        $this->assertSame($sqlIn($name), self::$imported[0]);
        $this->assertSame($sqlIn($safety), self::$imported[1]);
        $this->assertNotSame(self::$imported[0], self::$imported[1]);

        // Files were not touched.
        $this->assertFileExists($this->private . '/submissions/new.pdf');
        $this->assertDatabaseHas('audit_logs', ['action' => 'backup_restore_failed']);
    }

    #[Group('FR-SA'), Group('FR-SA-02')]
    public function test_only_expected_paths_are_taken_from_a_zip(): void
    {
        // A crafted zip uploaded as a backup, trying to write outside the folders.
        $crafted = $this->root . '/crafted.zip';
        $zip = new ZipArchive();
        $zip->open($crafted, ZipArchive::CREATE);
        $zip->addFromString('database.sql', '-- crafted');
        $zip->addFromString('manifest.json', json_encode(['system' => 'Siknayan LMS (MPSU ETEEAP)']));
        $zip->addFromString('files/private/../../escaped.txt', 'bad');
        $zip->addFromString('backend/.env', 'APP_KEY=bad');
        $zip->addFromString('files/private/ok.txt', 'fine');
        $zip->close();

        $name = $this->actingAs($this->admin)
            ->post('/api/system-admin/backups/upload', ['backup' => new UploadedFile($crafted, 'crafted.zip', 'application/zip', null, true)], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('backup.uploaded', true)
            ->json('backup.name');

        $this->travel(2)->seconds();
        $this->restore($name)->assertOk();

        $this->assertFileExists($this->private . '/ok.txt');
        $this->assertFileDoesNotExist($this->root . '/escaped.txt');
        $this->assertFileDoesNotExist(dirname($this->root) . '/escaped.txt');
        $this->assertFileDoesNotExist($this->private . '/backend/.env');
    }

    #[Group('FR-SA'), Group('FR-SA-02')]
    public function test_uploads_must_be_siknayan_backups(): void
    {
        $other = $this->root . '/other.zip';
        $zip = new ZipArchive();
        $zip->open($other, ZipArchive::CREATE);
        $zip->addFromString('readme.txt', 'hello');
        $zip->close();

        $upload = fn (string $path, string $as) => $this->actingAs($this->admin)->post(
            '/api/system-admin/backups/upload',
            ['backup' => new UploadedFile($path, $as, null, null, true)],
            ['Accept' => 'application/json']
        );

        $upload($other, 'other.zip')->assertStatus(422)->assertJsonValidationErrors('backup');

        file_put_contents($this->root . '/not-a-zip.zip', 'plain text');
        $upload($this->root . '/not-a-zip.zip', 'not-a-zip.zip')->assertStatus(422);

        $this->actingAs($this->admin)->getJson('/api/system-admin/backups')->assertOk()->assertJsonCount(0, 'backups');
    }

    #[Group('FR-SA'), Group('NFR-S'), Group('FR-SA-02'), Group('NFR-S-02')]
    public function test_other_roles_cannot_restore_or_upload(): void
    {
        $name = $this->makeBackup();

        foreach (['learner', 'instructor', 'academic_admin'] as $role) {
            $user = User::factory()->create(['role' => $role, 'school_id' => "RS-{$role}", 'is_active' => true]);

            $this->actingAs($user)->postJson("/api/system-admin/backups/{$name}/restore", [
                'password' => 'password', 'confirm' => 'RESTORE',
            ])->assertForbidden();

            $this->actingAs($user)->post('/api/system-admin/backups/upload', [], ['Accept' => 'application/json'])
                ->assertForbidden();
        }

        $this->assertSame([], self::$imported);
    }
}
