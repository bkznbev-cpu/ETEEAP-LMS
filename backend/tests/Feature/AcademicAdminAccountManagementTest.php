<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Course;
use App\Models\Module;
use App\Models\Submission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class AcademicAdminAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => '99-00001',
            'is_active' => true,
        ]);
    }

    #[Group('FR-UM'), Group('FR-UM-01')]
    public function test_academic_admin_can_deactivate_and_reactivate_a_learner(): void
    {
        $admin = $this->admin();
        $learner = User::factory()->create([
            'role' => 'learner',
            'owner_admin_id' => $admin->id,
            'school_id' => '24-12345',
            'password_setup_complete' => true,
        ]);
        $learner->createToken('test-token');

        $this->actingAs($admin)
            ->putJson("/api/admin/learners/{$learner->id}", [
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('learner.is_active', false);

        $this->assertDatabaseHas('users', [
            'id' => $learner->id,
            'is_active' => false,
        ]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $learner->id,
            'tokenable_type' => User::class,
        ]);

        $this->actingAs($admin)
            ->putJson("/api/admin/learners/{$learner->id}", [
                'is_active' => true,
            ])
            ->assertOk()
            ->assertJsonPath('learner.is_active', true);
    }

    #[Group('FR-UM'), Group('FR-UM-01')]
    public function test_academic_admin_can_change_a_learner_school_id_and_name(): void
    {
        $admin = $this->admin();
        $learner = User::factory()->create(['role' => 'learner', 'owner_admin_id' => $admin->id, 'school_id' => '23-00013', 'name' => 'Ana Cruz']);
        User::factory()->create(['role' => 'learner', 'owner_admin_id' => $admin->id, 'school_id' => '23-00014']);

        $this->actingAs($admin)
            ->putJson("/api/admin/learners/{$learner->id}", ['school_id' => '23-00099', 'name' => 'Ana M. Cruz'])
            ->assertOk()
            ->assertJsonPath('learner.school_id', '23-00099')
            ->assertJsonPath('learner.name', 'Ana M. Cruz');

        // Another learner's school ID, or the wrong format, is refused.
        $this->actingAs($admin)->putJson("/api/admin/learners/{$learner->id}", ['school_id' => '23-00014'])->assertStatus(422);
        $this->actingAs($admin)->putJson("/api/admin/learners/{$learner->id}", ['school_id' => '2300099'])->assertStatus(422);
        $this->assertSame('23-00099', $learner->fresh()->school_id);
    }

    #[Group('FR-UM'), Group('FR-UM-01')]
    public function test_academic_admin_can_change_an_instructor_id(): void
    {
        $admin = $this->admin();
        $instructor = User::factory()->create(['role' => 'instructor', 'owner_admin_id' => $admin->id, 'school_id' => 'INS-001']);
        User::factory()->create(['role' => 'instructor', 'owner_admin_id' => $admin->id, 'school_id' => 'INS-002']);

        $this->actingAs($admin)
            ->putJson("/api/admin/instructors/{$instructor->id}", ['school_id' => 'INS-100', 'name' => $instructor->name])
            ->assertOk();
        $this->assertSame('INS-100', $instructor->fresh()->school_id);

        // Another instructor's ID is refused.
        $this->actingAs($admin)->putJson("/api/admin/instructors/{$instructor->id}", ['school_id' => 'INS-002'])->assertStatus(422);
        $this->assertSame('INS-100', $instructor->fresh()->school_id);
    }

    #[Group('FR-UM'), Group('FR-UM-01')]
    public function test_academic_admin_can_deactivate_an_instructor(): void
    {
        $admin = $this->admin();
        $instructor = User::factory()->create([
            'role' => 'instructor',
            'owner_admin_id' => $admin->id,
            'school_id' => 'INS-00001',
            'password_setup_complete' => true,
        ]);

        $this->actingAs($admin)
            ->putJson("/api/admin/instructors/{$instructor->id}", [
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('instructor.is_active', false);

        $this->assertDatabaseHas('users', [
            'id' => $instructor->id,
            'is_active' => false,
        ]);
    }

    #[Group('FR-UM'), Group('FR-AU'), Group('FR-UM-01'), Group('FR-AU-01')]
    public function test_deactivated_accounts_cannot_log_in(): void
    {
        $user = User::factory()->create([
            'role' => 'learner',
            'school_id' => '24-12345',
            'password' => Hash::make('correct-password'),
            'is_active' => false,
        ]);

        $this->postJson('/api/login', [
            'school_id' => '24-12345',
            'password' => 'correct-password',
        ])
            ->assertForbidden()
            ->assertJsonPath('success', false);

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'is_active' => false,
        ]);
    }

    #[Group('FR-UM'), Group('NFR-S'), Group('FR-UM-01'), Group('NFR-S-02')]
    public function test_inactive_user_cannot_use_an_existing_sanctum_token(): void
    {
        $learner = User::factory()->create([
            'role' => 'learner',
            'school_id' => '24-12345',
            'is_active' => true,
        ]);
        $token = $learner->createToken('existing-token')->plainTextToken;

        $learner->is_active = false;
        $learner->save();

        $this->withToken($token)
            ->getJson('/api/student/courses')
            ->assertForbidden()
            ->assertJsonPath('success', false);
    }

    #[Group('FR-UM'), Group('NFR-S'), Group('FR-UM-01'), Group('NFR-S-02')]
    public function test_token_issued_after_deactivation_cannot_access_protected_routes(): void
    {
        $learner = User::factory()->create([
            'role' => 'learner',
            'school_id' => '24-12345',
            'is_active' => false,
        ]);
        $token = $learner->createToken('late-issued-token')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/student/courses')
            ->assertForbidden()
            ->assertJsonPath('success', false);
    }

    #[Group('FR-AU'), Group('FR-AU-01')]
    public function test_active_user_can_log_in_and_use_the_issued_sanctum_token(): void
    {
        User::factory()->create([
            'role' => 'learner',
            'school_id' => '24-12345',
            'password' => Hash::make('correct-password'),
            'is_active' => true,
        ]);

        $login = $this->postJson('/api/login', [
            'school_id' => '24-12345',
            'password' => 'correct-password',
        ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $token = $login->json('token');
        $this->assertNotEmpty($token);

        $this->withToken($token)
            ->getJson('/api/student/courses')
            ->assertOk();
    }

    #[Group('FR-AU'), Group('FR-AU-02')]
    public function test_academic_admin_can_complete_first_login_password_setup(): void
    {
        $admin = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => '99-00001',
            'password' => Hash::make('temporary-password'),
            'password_setup_complete' => false,
            'is_active' => true,
        ]);
        $temporaryToken = $admin->createToken('temporary-login')->plainTextToken;

        $response = $this->withToken($temporaryToken)
            ->postJson('/api/admin/setup-password', [
                'password' => 'NewSecurePassword123',
                'password_confirmation' => 'NewSecurePassword123',
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $replacementToken = $response->json('token');
        $this->assertNotEmpty($replacementToken);
        $this->assertTrue(Hash::check(
            'NewSecurePassword123',
            $admin->fresh()->password
        ));
        $this->assertTrue($admin->fresh()->password_setup_complete);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $admin->id,
            'name' => 'temporary-login',
        ]);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $admin->id,
            'name' => 'auth_token',
        ]);

        $this->withToken($replacementToken)
            ->getJson('/api/admin/dashboard')
            ->assertOk();
    }

    #[Group('FR-PT'), Group('FR-PT-03'), Group('FR-PT-06')]
    public function test_dashboard_reports_submitted_submissions_awaiting_a_grade(): void
    {
        $admin = $this->admin();
        $learner = User::factory()->create([
            'role' => 'learner',
            'owner_admin_id' => $admin->id,
            'school_id' => '24-12345',
        ]);
        $course = Course::create([
            'owner_admin_id' => $admin->id,
            'name' => 'Dashboard Test Course',
            'code' => 'DASH-101',
            'is_active' => true,
        ]);
        $module = Module::create([
            'course_id' => $course->id,
            'title' => 'Dashboard Test Module',
        ]);

        Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'submitted',
        ]);

        $gradedModule = Module::create([
            'course_id' => $course->id,
            'title' => 'Dashboard Graded Module',
        ]);

        Submission::create([
            'module_id' => $gradedModule->id,
            'learner_id' => $learner->id,
            'status' => 'graded',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('statistics.awaiting_grade', 1);
    }

    #[Group('FR-PT'), Group('FR-PT-04')]
    public function test_academic_admin_reports_records_from_the_database(): void
    {
        $admin = $this->admin();
        $learner = User::factory()->create([
            'role' => 'learner',
            'owner_admin_id' => $admin->id,
            'school_id' => '24-12345',
            'program' => 'ETEEAP',
        ]);
        $instructor = User::factory()->create([
            'role' => 'instructor',
            'owner_admin_id' => $admin->id,
            'school_id' => '99-00002',
            'program' => 'ETEEAP',
        ]);
        $course = Course::create([
            'owner_admin_id' => $admin->id,
            'name' => 'Reports Test Course',
            'code' => 'RPT-101',
            'subject_code' => 'RPT101',
            'program' => 'ETEEAP',
            'instructor_id' => $instructor->id,
            'is_active' => true,
        ]);
        $course->learners()->attach($learner->id);
        $module = Module::create([
            'course_id' => $course->id,
            'title' => 'Reports Test Module',
        ]);
        Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'submitted',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/reports')
            ->assertOk()
            ->assertJsonPath('learners.0.school_id', '24-12345')
            ->assertJsonPath('classes.0.learnerIds.0', $learner->id)
            ->assertJsonPath("modules.{$learner->id}.0.moduleId", $module->id)
            ->assertJsonPath("modules.{$learner->id}.0.status", 'awaiting grade');
    }

    #[Group('FR-CM'), Group('FR-CM-01')]
    public function test_academic_admin_deleting_a_class_persists_to_the_database(): void
    {
        $admin = $this->admin();
        $course = Course::create([
            'owner_admin_id' => $admin->id,
            'name' => 'Delete Test Course',
            'code' => 'DEL-101',
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/admin/classes/{$course->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('courses', [
            'id' => $course->id,
        ]);
    }

    #[Group('FR-AU'), Group('NFR-S'), Group('FR-AU-02'), Group('NFR-S-02')]
    public function test_non_admin_cannot_complete_academic_admin_password_setup(): void
    {
        $learner = User::factory()->create([
            'role' => 'learner',
            'school_id' => '24-12345',
            'password_setup_complete' => false,
            'is_active' => true,
        ]);
        $token = $learner->createToken('temporary-login')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/admin/setup-password', [
                'password' => 'NewSecurePassword123',
                'password_confirmation' => 'NewSecurePassword123',
            ])
            ->assertForbidden();

        $this->assertFalse($learner->fresh()->password_setup_complete);
    }

    #[Group('FR-UM'), Group('NFR-S'), Group('FR-UM-01'), Group('NFR-S-02')]
    public function test_non_admin_cannot_change_account_status(): void
    {
        $learner = User::factory()->create([
            'role' => 'learner',
            'school_id' => '24-12345',
            'is_active' => true,
        ]);
        $target = User::factory()->create([
            'role' => 'learner',
            'school_id' => '24-12346',
        ]);

        $this->actingAs($learner)
            ->putJson("/api/admin/learners/{$target->id}", [
                'is_active' => false,
            ])
            ->assertForbidden();

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'is_active' => true,
        ]);
    }
}
