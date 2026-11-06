<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Group;
use Tests\Concerns\BuildsClassroom;
use Tests\TestCase;

/**
 * Grading and feedback gaps not covered by ScoringCardTest and GradeEmailTest.
 */
#[Group('integration')]
class GradingTest extends TestCase
{
    use RefreshDatabase;
    use BuildsClassroom;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->buildClassroom();
    }

    #[Group('FR-GF'), Group('FR-GF-01'), Group('FR-GF-02')]
    public function test_instructor_can_grade_with_a_score_over_a_maximum_and_save_feedback(): void
    {
        $submission = $this->submitAndGet();

        $this->gradeSubmission($submission, ['score' => 18, 'max_score' => 20, 'feedback' => 'Well argued.'])->assertOk();

        $this->assertDatabaseHas('grades', [
            'submission_id' => $submission->id,
            'feedback' => 'Well argued.',
        ]);
        $grade = $submission->fresh()->grade;
        $this->assertEquals(18, $grade->score);
        $this->assertEquals(20, $grade->max_score);
    }

    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_score_above_maximum_is_rejected(): void
    {
        $submission = $this->submitAndGet();

        $this->gradeSubmission($submission, ['score' => 25, 'max_score' => 20])->assertStatus(422);
        $this->assertNull($submission->fresh()->grade);
    }

    #[Group('FR-GF'), Group('FR-GF-03')]
    public function test_learner_can_view_own_grade_and_feedback(): void
    {
        $submission = $this->submitAndGet();
        $this->gradeSubmission($submission, ['score' => 18, 'max_score' => 20, 'feedback' => 'Well argued.'])->assertOk();

        $grades = $this->actingAs($this->learner)->getJson('/api/student/grades')->assertOk()->json();

        $this->assertStringContainsString('Well argued.', json_encode($grades));
        $this->assertStringContainsString('"submission_id":' . $submission->id, json_encode($grades));
    }

    #[Group('FR-GF'), Group('NFR-S'), Group('FR-GF-03'), Group('NFR-S-02')]
    public function test_learner_cannot_view_another_learners_grade(): void
    {
        $submission = $this->submitAndGet();
        $this->gradeSubmission($submission, ['score' => 18, 'max_score' => 20, 'feedback' => 'Well argued.'])->assertOk();

        $other = $this->actingAs($this->otherLearner)->getJson('/api/student/grades')->assertOk()->json();
        $this->assertStringNotContainsString('Well argued.', json_encode($other));

        $this->actingAs($this->otherLearner)
            ->getJson("/api/student/submissions/{$submission->id}/file")
            ->assertNotFound();
    }
}
