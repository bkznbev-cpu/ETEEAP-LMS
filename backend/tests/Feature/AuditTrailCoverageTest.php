<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\Course;
use App\Models\Module;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\Backup\DatabaseDumper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * Every kind of change the audit trail must show, with old -> new values.
 */
#[Group('integration')]
class AuditTrailCoverageTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $instructor;
    private User $learner;
    private Course $class;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-AT', 'name' => 'Princess', 'is_active' => true]);
        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-AT', 'name' => 'Prof Reyes', 'is_active' => true, 'owner_admin_id' => $this->admin->id]);
        $this->learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-00777', 'name' => 'Ana Cruz', 'is_active' => true, 'owner_admin_id' => $this->admin->id]);
        $this->class = Course::create(['name' => 'Web Development', 'code' => 'WEB-101', 'is_active' => true, 'instructor_id' => $this->instructor->id, 'owner_admin_id' => $this->admin->id]);
        $this->class->learners()->attach($this->learner->id);
    }

    private function last(string $action, string $module): AuditLogEntry
    {
        return AuditLogEntry::where('action', $action)->where('module', $module)->latest('id')->firstOrFail();
    }

    #[Group('FR-SA'), Group('FR-GF'), Group('FR-SA-03'), Group('FR-GF-04')]
    public function test_instructor_grade_change_shows_old_and_new_grade(): void
    {
        $module = Module::create(['course_id' => $this->class->id, 'title' => 'HTML Basics', 'is_published' => true, 'module_order' => 1]);
        $this->actingAs($this->learner)->post('/api/student/submissions', [
            'module_id' => $module->id,
            'file' => UploadedFile::fake()->createWithContent('work.pdf', '%PDF-1.4'),
        ], ['Accept' => 'application/json'])->assertCreated();
        $submissionId = $module->submissions()->value('id');

        $this->assertSame('Submitted "HTML Basics" for Web Development', $this->last('submit', AuditLogger::SUBMISSIONS)->details);

        $row = ['title' => 'Activity 1', 'score' => 40, 'max_score' => 50];
        $this->actingAs($this->instructor)->postJson("/api/instructor/submissions/{$submissionId}/grade", ['items' => [$row]])->assertOk();

        $created = $this->last('create', AuditLogger::GRADES);
        $this->assertSame('grade', $created->target_type);
        $this->assertSame(40.0, (float) $created->new_values['score']);
        $this->assertSame($this->instructor->id, $created->actor_id);

        // Scores already given are locked, so the grade changes by adding an activity.
        $this->actingAs($this->instructor)->postJson("/api/instructor/submissions/{$submissionId}/grade", [
            'items' => [$row, ['title' => 'Bonus task', 'score' => 8, 'max_score' => 10]],
            'feedback' => 'Good work',
        ])->assertOk();

        $changed = $this->last('update', AuditLogger::GRADES);
        $this->assertEquals(['score' => 40, 'max_score' => 50, 'feedback' => null, 'activities' => 1], $changed->old_values);
        $this->assertEquals(['score' => 48, 'max_score' => 60, 'feedback' => 'Good work', 'activities' => 2], $changed->new_values);
        $this->assertSame('Changed the grade of Ana Cruz for "HTML Basics" from 40/50 to 48/60', $changed->details);
        $this->assertSame('instructor', $changed->actor_role);
    }

    #[Group('FR-SA'), Group('FR-UM'), Group('FR-SA-03'), Group('FR-UM-01')]
    public function test_learner_account_lifecycle(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/learners', [
            'name' => 'Ben Lim', 'school_id' => '24-00888', 'password' => 'Temp-pass-123', 'program' => 'BSIT',
        ])->assertCreated();
        $ben = User::where('school_id', '24-00888')->firstOrFail();

        $created = $this->last('create', AuditLogger::LEARNERS);
        $this->assertSame('24-00888', $created->target_id);
        $this->assertSame('BSIT', $created->new_values['program']);

        $this->actingAs($this->admin)->putJson("/api/admin/learners/{$ben->id}", ['program' => 'BSOA', 'is_active' => false, 'password' => 'New-temp-pass-1'])->assertOk();

        $update = $this->last('update', AuditLogger::LEARNERS);
        $this->assertSame(['program' => 'BSIT'], $update->old_values);
        $this->assertSame(['program' => 'BSOA'], $update->new_values);
        $this->assertSame(['is_active' => false], $this->last('deactivate', AuditLogger::LEARNERS)->new_values);
        $this->last('reset_password', AuditLogger::LEARNERS);

        $this->actingAs($this->admin)->deleteJson("/api/admin/learners/{$ben->id}")->assertOk();
        $this->assertSame('Ben Lim', $this->last('delete', AuditLogger::LEARNERS)->old_values['name']);

        // No password ever reaches the trail.
        $all = AuditLogEntry::all()->toJson();
        $this->assertStringNotContainsString('Temp-pass-123', $all);
        $this->assertStringNotContainsString('New-temp-pass-1', $all);
    }

    #[Group('FR-SA'), Group('FR-CM'), Group('FR-SA-03'), Group('FR-CM-01'), Group('FR-CM-03')]
    public function test_classes_and_enrolment(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/classes', ['name' => 'Records Management', 'code' => 'OA-102'])->assertCreated();
        $class = Course::where('code', 'OA-102')->firstOrFail();
        $this->assertSame('OA-102', $this->last('create', AuditLogger::CLASSES)->target_id);

        $this->actingAs($this->admin)->putJson("/api/admin/classes/{$class->id}", ['name' => 'Records Management 2'])->assertOk();
        $update = $this->last('update', AuditLogger::CLASSES);
        $this->assertSame(['name' => 'Records Management'], $update->old_values);
        $this->assertSame(['name' => 'Records Management 2'], $update->new_values);

        $this->actingAs($this->admin)->postJson("/api/admin/classes/{$class->id}/learners", ['learner_id' => $this->learner->id])->assertCreated();
        $this->assertSame('Enrolled Ana Cruz (24-00777) in OA-102', $this->last('enroll', AuditLogger::CLASSES)->details);

        $this->actingAs($this->admin)->deleteJson("/api/admin/classes/{$class->id}/learners/{$this->learner->id}")->assertOk();
        $this->assertSame('Removed Ana Cruz (24-00777) from OA-102', $this->last('unenroll', AuditLogger::CLASSES)->details);
    }

    #[Group('FR-SA'), Group('FR-ML'), Group('FR-SA-03'), Group('FR-ML-03')]
    public function test_module_material_upload_and_replace(): void
    {
        $upload = fn (string $name) => $this->actingAs($this->admin)->post('/api/admin/module-files', [
            'file' => UploadedFile::fake()->createWithContent($name, '%PDF-1.4'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('file_path');

        $first = $upload('Lesson 1.pdf');
        $this->assertSame('Lesson 1.pdf', $this->last('upload', AuditLogger::MODULES)->target_id);

        $sync = fn (?string $path, ?string $name) => $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'lesson-1', 'title' => 'Lesson 1', 'material_path' => $path, 'material_name' => $name, 'module_order' => 1, 'is_published' => true]],
        ])->assertOk();

        $sync($first, 'Lesson 1.pdf');
        $this->assertSame('Added module "Lesson 1" to WEB-101', $this->last('create', AuditLogger::MODULES)->details);

        $second = $upload('Lesson 1 v2.pdf');
        $sync($second, 'Lesson 1 v2.pdf');
        $replace = $this->last('replace', AuditLogger::MODULES);
        $this->assertSame(['material_name' => 'Lesson 1.pdf'], $replace->old_values);
        $this->assertSame(['material_name' => 'Lesson 1 v2.pdf'], $replace->new_values);

        $sync(null, null);
        $this->assertSame(['material_name' => 'Lesson 1 v2.pdf'], $this->last('delete', AuditLogger::MODULES)->old_values);
    }

    #[Group('FR-SA'), Group('FR-SA-03'), Group('FR-SA-01')]
    public function test_failed_backup_is_logged(): void
    {
        $system = User::factory()->create(['role' => 'system_admin', 'school_id' => 'SYS-AT', 'is_active' => true]);
        config(['backup.directory' => sys_get_temp_dir() . '/skb-fail-' . bin2hex(random_bytes(3))]);
        $this->app->instance(DatabaseDumper::class, new class extends DatabaseDumper {
            public function dump(string $sqlPath): void
            {
                throw new RuntimeException('The database could not be saved: test failure');
            }
        });

        $this->actingAs($system)->postJson('/api/system-admin/backups')->assertStatus(500);

        $failed = $this->last('backup_failed', AuditLogger::BACKUP);
        $this->assertSame('failed', $failed->result);
        $this->assertStringContainsString('test failure', $failed->details);
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_real_ip_is_recorded_only_behind_a_trusted_proxy(): void
    {
        $user = User::factory()->create(['role' => 'learner', 'school_id' => '24-00999', 'password' => Hash::make('right-pass-1'), 'is_active' => true]);
        $login = fn (array $server) => $this->withServerVariables($server)
            ->postJson('/api/login', ['school_id' => '24-00999', 'password' => 'right-pass-1'])->assertOk();

        // Not trusted (default): a forged X-Forwarded-For is ignored.
        $login(['REMOTE_ADDR' => '172.18.0.5', 'HTTP_X_FORWARDED_FOR' => '203.0.113.9']);
        $this->assertSame('172.18.0.5', $this->last('sign_in', AuditLogger::AUTH)->ip_address);
    }
}
