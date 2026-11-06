<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Grade;
use App\Models\Module;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * The Learners list sends each learner's modules (from their classes)
 * with where the learner is, so Learner Details can list them and the
 * "Modules Assigned" count matches the list.
 */
#[Group('integration')]
class AdminLearnerModulesTest extends TestCase
{
    use RefreshDatabase;

    #[Group('FR-PT'), Group('FR-PT-05')]
    public function test_each_learner_comes_with_their_modules_and_state(): void
    {
        $admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-LM', 'is_active' => true]);
        $instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-LM', 'is_active' => true, 'owner_admin_id' => $admin->id]);
        $learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-LM001', 'is_active' => true, 'owner_admin_id' => $admin->id]);

        $class = Course::create([
            'name' => 'Intro to Computing', 'code' => 'IT-101', 'is_active' => true,
            'instructor_id' => $instructor->id, 'owner_admin_id' => $admin->id,
        ]);
        $class->learners()->attach($learner->id);

        $notStarted = Module::create(['course_id' => $class->id, 'title' => 'Lesson 1', 'is_published' => true, 'module_order' => 1]);
        $handedIn = Module::create(['course_id' => $class->id, 'title' => 'Lesson 2', 'is_published' => true, 'module_order' => 2]);
        $graded = Module::create(['course_id' => $class->id, 'title' => 'Lesson 3', 'is_published' => true, 'module_order' => 3]);
        Module::create(['course_id' => $class->id, 'title' => 'Draft', 'is_published' => false, 'module_order' => 4]);

        Submission::create(['module_id' => $handedIn->id, 'learner_id' => $learner->id, 'status' => 'submitted']);
        $done = Submission::create(['module_id' => $graded->id, 'learner_id' => $learner->id, 'status' => 'graded']);
        Grade::create(['submission_id' => $done->id, 'instructor_id' => $instructor->id, 'score' => 8, 'max_score' => 10]);

        $response = $this->actingAs($admin)->getJson('/api/admin/learners')->assertOk();

        // The unpublished draft is neither counted nor listed.
        $response->assertJsonPath('learners.0.modules_assigned', 3)
            ->assertJsonCount(3, 'learners.0.modules')
            ->assertJsonPath('learners.0.modules.0.title', 'Lesson 1')
            ->assertJsonPath('learners.0.modules.0.course', 'Intro to Computing')
            ->assertJsonPath('learners.0.modules.0.state', 'in-progress')
            ->assertJsonPath('learners.0.modules.1.state', 'submitted')
            ->assertJsonPath('learners.0.modules.2.state', 'completed');

        $this->assertNotNull($notStarted->id);
    }
}
