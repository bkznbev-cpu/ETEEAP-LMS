<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Grade;
use App\Models\Module;
use App\Models\Progress;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AcademicAdminSafeDeleteTest extends TestCase
{
    use RefreshDatabase;

    private ?User $admin = null;

    // Learners and instructors belong to this test's Academic Admin.
    private function user(string $role, bool $setUp = true): User
    {
        return User::factory()->create([
            'role' => $role,
            'password_setup_complete' => $setUp,
            'school_id' => fake()->unique()->numerify('SD-#####'),
            'is_active' => true,
            'owner_admin_id' => $role === 'academic_admin' ? null : $this->admin()->id,
        ]);
    }

    private function admin(): User
    {
        return $this->admin ??= User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => fake()->unique()->numerify('SD-ADM-#####'),
            'is_active' => true,
        ]);
    }

    private function classWithModule(?User $instructor = null): array
    {
        $course = Course::create([
            'owner_admin_id' => $this->admin()->id,
            'name' => 'Safe Delete Course',
            'code' => 'SAFE-' . fake()->unique()->numberBetween(100, 999),
            'instructor_id' => $instructor?->id,
            'is_active' => true,
        ]);

        $module = Module::create([
            'course_id' => $course->id,
            'title' => 'Safe Delete Module',
        ]);

        return [$course, $module];
    }

    public function test_learner_with_a_submission_cannot_be_deleted(): void
    {
        $learner = $this->user('learner');
        [, $module] = $this->classWithModule();
        Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'submitted',
        ]);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/learners/{$learner->id}")
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('users', ['id' => $learner->id]);
        $this->assertDatabaseHas('submissions', ['learner_id' => $learner->id]);
    }

    public function test_learner_with_progress_cannot_be_deleted(): void
    {
        $learner = $this->user('learner');
        [, $module] = $this->classWithModule();
        Progress::create([
            'learner_id' => $learner->id,
            'module_id' => $module->id,
            'status' => 'in_progress',
            'completion_percentage' => 50,
        ]);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/learners/{$learner->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('users', ['id' => $learner->id]);
    }

    public function test_learner_without_records_can_be_deleted(): void
    {
        $learner = $this->user('learner', setUp: false);
        $learner->createToken('test');

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/learners/{$learner->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('users', ['id' => $learner->id]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $learner->id,
            'tokenable_type' => User::class,
        ]);
    }

    public function test_instructor_who_graded_work_cannot_be_deleted(): void
    {
        $instructor = $this->user('instructor');
        $learner = $this->user('learner');
        // The class has no instructor, so only the grade blocks the delete.
        [, $module] = $this->classWithModule();
        $submission = Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'graded',
        ]);
        Grade::create([
            'submission_id' => $submission->id,
            'instructor_id' => $instructor->id,
            'score' => 90,
            'max_score' => 100,
        ]);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/instructors/{$instructor->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('users', ['id' => $instructor->id]);
        $this->assertDatabaseHas('grades', ['submission_id' => $submission->id]);
    }

    public function test_instructor_assigned_to_a_class_cannot_be_deleted(): void
    {
        $instructor = $this->user('instructor');
        [$course] = $this->classWithModule($instructor);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/instructors/{$instructor->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('courses', [
            'id' => $course->id,
            'instructor_id' => $instructor->id,
        ]);
    }

    public function test_instructor_without_records_can_be_deleted(): void
    {
        $instructor = $this->user('instructor', setUp: false);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/instructors/{$instructor->id}")
            ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $instructor->id]);
    }

    public function test_set_up_accounts_without_records_can_be_deleted(): void
    {
        foreach (['learner' => 'learners', 'instructor' => 'instructors'] as $role => $path) {
            foreach ([true, false] as $active) {
                $account = $this->user($role);
                $account->update(['is_active' => $active]);

                $this->actingAs($this->admin())
                    ->deleteJson("/api/admin/{$path}/{$account->id}")
                    ->assertOk();

                $this->assertDatabaseMissing('users', ['id' => $account->id]);
            }
        }
    }

    public function test_set_up_learner_with_submissions_still_cannot_be_deleted(): void
    {
        $learner = $this->user('learner');
        [, $module] = $this->classWithModule();
        Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'submitted',
        ]);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/learners/{$learner->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('users', ['id' => $learner->id]);
    }

    public function test_deactivated_learner_with_submissions_still_cannot_be_deleted(): void
    {
        $learner = $this->user('learner');
        $learner->update(['is_active' => false]);
        [, $module] = $this->classWithModule();
        Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'submitted',
        ]);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/learners/{$learner->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('submissions', ['learner_id' => $learner->id]);
    }

    public function test_account_lists_say_which_accounts_were_set_up(): void
    {
        $setUpLearner = $this->user('learner');
        $newLearner = $this->user('learner', setUp: false);
        $setUpInstructor = $this->user('instructor');
        $newInstructor = $this->user('instructor', setUp: false);

        $learners = collect($this->actingAs($this->admin())->getJson('/api/admin/learners')
            ->assertOk()->json('learners'))->keyBy('id');
        $this->assertTrue($learners[$setUpLearner->id]['account_set_up']);
        $this->assertFalse($learners[$newLearner->id]['account_set_up']);

        $instructors = collect($this->actingAs($this->admin())->getJson('/api/admin/instructors')
            ->assertOk()->json('instructors'))->keyBy('id');
        $this->assertTrue($instructors[$setUpInstructor->id]['account_set_up']);
        $this->assertFalse($instructors[$newInstructor->id]['account_set_up']);
    }

    public function test_class_with_submissions_cannot_be_deleted(): void
    {
        $learner = $this->user('learner');
        [$course, $module] = $this->classWithModule();
        Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'submitted',
        ]);

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/classes/{$course->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('courses', ['id' => $course->id]);
        $this->assertDatabaseHas('submissions', ['module_id' => $module->id]);
    }

    public function test_class_with_submissions_on_a_removed_module_cannot_be_deleted(): void
    {
        $learner = $this->user('learner');
        [$course, $module] = $this->classWithModule();
        Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'submitted',
        ]);
        $module->delete(); // soft delete; the database row still exists

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/classes/{$course->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('submissions', ['module_id' => $module->id]);
    }

    public function test_class_without_learner_records_can_be_deleted(): void
    {
        [$course] = $this->classWithModule();

        $this->actingAs($this->admin())
            ->deleteJson("/api/admin/classes/{$course->id}")
            ->assertOk();

        $this->assertDatabaseMissing('courses', ['id' => $course->id]);
    }
}
