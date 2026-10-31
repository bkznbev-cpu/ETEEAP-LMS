<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Grade;
use App\Models\Module;
use App\Models\Notification;
use App\Models\Progress;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Learners can unsubmit their own work until the instructor grades it.
 */
class UnsubmitTest extends TestCase
{
    use RefreshDatabase;

    private User $instructor;
    private User $learner;
    private User $otherLearner;
    private Module $module;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-UN', 'is_active' => true]);
        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-UN', 'is_active' => true]);
        $this->learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-UN001', 'name' => 'Ana Cruz', 'is_active' => true]);
        $this->otherLearner = User::factory()->create(['role' => 'learner', 'school_id' => '24-UN002', 'is_active' => true]);

        $class = Course::create([
            'name' => 'Web Development', 'code' => 'WEB-101', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $admin->id,
        ]);
        $class->learners()->attach([$this->learner->id, $this->otherLearner->id]);

        $this->module = Module::create(['course_id' => $class->id, 'title' => 'HTML Basics', 'is_published' => true, 'module_order' => 1]);
    }

    private function submit(?User $learner = null): Submission
    {
        $this->actingAs($learner ?? $this->learner)->post('/api/student/submissions', [
            'module_id' => $this->module->id,
            'file' => UploadedFile::fake()->createWithContent('work.pdf', '%PDF-1.4 my work'),
        ], ['Accept' => 'application/json'])->assertCreated();

        return Submission::where('learner_id', ($learner ?? $this->learner)->id)->latest('id')->firstOrFail();
    }

    public function test_learner_can_unsubmit_ungraded_work_and_submit_again(): void
    {
        $submission = $this->submit();
        Storage::disk('local')->assertExists($submission->file_path);

        $this->actingAs($this->learner)->deleteJson("/api/student/submissions/{$submission->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('submissions', ['id' => $submission->id]);
        Storage::disk('local')->assertMissing($submission->file_path);

        $progress = Progress::where('learner_id', $this->learner->id)->where('module_id', $this->module->id)->first();
        $this->assertSame('not_started', $progress->status);

        // Unsubmitting does not notify the instructor.
        $this->assertFalse(Notification::where('user_id', $this->instructor->id)
            ->where('title', 'Submission Withdrawn')->exists());

        $this->actingAs($this->learner)->getJson("/api/student/modules/{$this->module->id}")
            ->assertOk()
            ->assertJsonPath('module.my_submission', null);

        // Can submit again
        $this->submit();
    }

    public function test_graded_work_cannot_be_unsubmitted(): void
    {
        $submission = $this->submit();

        Grade::create([
            'submission_id' => $submission->id, 'instructor_id' => $this->instructor->id,
            'score' => 8, 'max_score' => 10, 'graded_at' => now(),
        ]);

        $this->actingAs($this->learner)->deleteJson("/api/student/submissions/{$submission->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('submissions', ['id' => $submission->id]);
        $this->assertDatabaseHas('grades', ['submission_id' => $submission->id]);
        Storage::disk('local')->assertExists($submission->file_path);
    }

    public function test_learner_cannot_unsubmit_someone_elses_work(): void
    {
        $submission = $this->submit($this->otherLearner);

        $this->actingAs($this->learner)->deleteJson("/api/student/submissions/{$submission->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('submissions', ['id' => $submission->id]);
    }

    public function test_instructor_cannot_use_the_learner_unsubmit_route(): void
    {
        $submission = $this->submit();

        $this->actingAs($this->instructor)->deleteJson("/api/student/submissions/{$submission->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('submissions', ['id' => $submission->id]);
    }

    public function test_grading_an_unsubmitted_activity_reports_it_is_gone(): void
    {
        $submission = $this->submit();

        $this->actingAs($this->learner)->deleteJson("/api/student/submissions/{$submission->id}")->assertOk();

        $this->actingAs($this->instructor)->postJson("/api/instructor/submissions/{$submission->id}/grade", [
            'score' => 8, 'max_score' => 10,
        ])->assertNotFound();

        $this->assertDatabaseCount('grades', 0);
    }
}
