<?php

namespace Tests\Feature;

use App\Mail\ActivityGraded;
use App\Models\Course;
use App\Models\Module;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class GradeEmailTest extends TestCase
{
    use RefreshDatabase;

    private User $instructor;
    private User $learner;
    private Submission $submission;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-GE1', 'is_active' => true]);
        $this->learner = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-GE001', 'name' => 'Ana Cruz',
            'email' => 'ana@example.com', 'is_active' => true,
        ]);

        $course = Course::create([
            'name' => 'Web Development', 'code' => 'WEB-101',
            'instructor_id' => $this->instructor->id, 'is_active' => true,
        ]);
        $module = Module::create(['course_id' => $course->id, 'title' => 'HTML Basics']);
        $this->submission = Submission::create([
            'module_id' => $module->id, 'learner_id' => $this->learner->id, 'status' => 'submitted',
        ]);
    }

    /** Grades with a scoring card (one row per activity). */
    private function grade(array $rows, ?string $feedback = null)
    {
        return $this->actingAs($this->instructor)
            ->postJson("/api/instructor/submissions/{$this->submission->id}/grade", [
                'items' => array_map(fn ($row) => ['title' => $row[0], 'score' => $row[1], 'max_score' => $row[2]], $rows),
                'feedback' => $feedback,
            ])
            ->assertSuccessful();
    }

    /*
     * Emails go out after the response. The test client runs that step
     * after every request, and in tests earlier steps run again, so the
     * tests look at which kinds of email were sent rather than counting.
     */
    private function sent(bool $isNewGrade): int
    {
        return Mail::sent(ActivityGraded::class, fn (ActivityGraded $mail) => $mail->isNewGrade === $isNewGrade)
            ->unique(fn (ActivityGraded $mail) => spl_object_id($mail))
            ->count();
    }

    #[Group('FR-NM'), Group('FR-NM-03')]
    public function test_the_learner_is_emailed_when_an_activity_is_graded(): void
    {
        $this->grade([['Quiz 1', 85, 100]], 'Good work.');

        Mail::assertSent(ActivityGraded::class, function (ActivityGraded $mail) {
            $html = $mail->render();

            return $mail->hasTo('ana@example.com')
                && $mail->isNewGrade
                && str_contains($mail->envelope()->subject, 'HTML Basics')
                && str_contains($html, '85 / 100')
                && str_contains($html, 'Good work.');
        });
    }

    #[Group('FR-NM'), Group('FR-GF'), Group('FR-NM-03'), Group('FR-GF-02')]
    public function test_a_feedback_only_change_is_not_emailed_again(): void
    {
        $this->grade([['Quiz 1', 70, 100]]);
        $this->grade([['Quiz 1', 70, 100]], 'Added a comment.');

        $this->assertSame(1, $this->sent(true));
        $this->assertSame(0, $this->sent(false));
    }

    #[Group('FR-NM'), Group('FR-GF'), Group('FR-NM-03'), Group('FR-GF-04')]
    public function test_a_changed_score_is_emailed(): void
    {
        $this->grade([['Quiz 1', 70, 100]]);
        $this->grade([['Quiz 1', 70, 100], ['Quiz 2', 40, 50]]);

        $this->assertSame(1, $this->sent(false));
        Mail::assertSent(ActivityGraded::class, fn (ActivityGraded $mail) => !$mail->isNewGrade && str_contains($mail->render(), '110 / 150'));
    }

    #[Group('FR-NM'), Group('FR-NM-03')]
    public function test_learners_without_an_email_are_not_emailed(): void
    {
        $this->learner->update(['email' => null]);

        $this->grade([['Quiz 1', 80, 100]]);

        Mail::assertNothingSent();
    }
}
