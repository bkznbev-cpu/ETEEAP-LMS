<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\GradeItem;
use App\Models\Module;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * Grading a compiled submission with a scoring card: one row per
 * activity (title, score, over); the grade holds the totals.
 */
#[Group('integration')]
class ScoringCardTest extends TestCase
{
    use RefreshDatabase;

    private User $instructor;
    private User $learner;
    private Course $class;
    private Module $module;
    private Submission $submission;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-SC', 'is_active' => true]);
        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-SC', 'is_active' => true]);
        $this->learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-SC001', 'is_active' => true]);

        $this->class = Course::create([
            'name' => 'Web Development', 'code' => 'WEB-101', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $admin->id,
        ]);
        $this->class->learners()->attach($this->learner->id);
        $this->module = Module::create(['course_id' => $this->class->id, 'title' => 'Module 1', 'is_published' => true, 'module_order' => 1]);

        $this->actingAs($this->learner)->post('/api/student/submissions', [
            'module_id' => $this->module->id,
            'file' => UploadedFile::fake()->createWithContent('compiled.pdf', '%PDF-1.4 all activities'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->submission = Submission::firstOrFail();
    }

    private function grade(array $body)
    {
        return $this->actingAs($this->instructor)
            ->postJson("/api/instructor/submissions/{$this->submission->id}/grade", $body);
    }

    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_scoring_card_saves_rows_and_totals(): void
    {
        $this->grade([
            'items' => [
                ['title' => 'Activity 1: HTML page', 'score' => 18, 'max_score' => 20],
                ['title' => 'Activity 2: CSS layout', 'score' => 25.5, 'max_score' => 30],
                ['title' => 'Quiz', 'score' => 9, 'max_score' => 10],
            ],
            'feedback' => 'Good work overall.',
        ])->assertOk()
            ->assertJsonPath('grade.score', '52.50')
            ->assertJsonPath('grade.max_score', '60.00')
            ->assertJsonCount(3, 'grade.items')
            ->assertJsonPath('grade.items.1.title', 'Activity 2: CSS layout');

        // The learner sees the totals and every row, in order.
        $this->actingAs($this->learner)->getJson("/api/student/modules/{$this->module->id}")
            ->assertOk()
            ->assertJsonPath('module.my_submission.grade.percentage', 87.5)
            ->assertJsonCount(3, 'module.my_submission.grade.items')
            ->assertJsonPath('module.my_submission.grade.items.0.title', 'Activity 1: HTML page')
            ->assertJsonPath('module.my_submission.grade.items.0.score', 18)
            ->assertJsonPath('module.my_submission.grade.items.0.max_score', 20);

        $this->actingAs($this->learner)->getJson('/api/student/grades')
            ->assertOk()->assertJsonCount(3, 'grades.0.items');

        // The instructor's submissions list includes the rows too.
        $this->actingAs($this->instructor)->getJson('/api/instructor/submissions')
            ->assertOk()->assertJsonFragment(['title' => 'Quiz']);
    }

    #[Group('FR-GF'), Group('FR-GF-04')]
    public function test_scores_already_given_cannot_be_changed(): void
    {
        $a = ['title' => 'A', 'score' => 5, 'max_score' => 10];
        $b = ['title' => 'B', 'score' => 7, 'max_score' => 10];
        $this->grade(['items' => [$a, $b], 'feedback' => 'Good'])->assertOk();

        $locked = "Scores already given can't be changed. You can only add new activities.";

        // Changing a score, the "over", a title, the order, or removing a row is refused.
        $this->grade(['items' => [['title' => 'A', 'score' => 9, 'max_score' => 10], $b]])->assertStatus(422)->assertJsonPath('message', $locked);
        $this->grade(['items' => [['title' => 'A', 'score' => 5, 'max_score' => 20], $b]])->assertStatus(422);
        $this->grade(['items' => [['title' => 'Renamed', 'score' => 5, 'max_score' => 10], $b]])->assertStatus(422);
        $this->grade(['items' => [$b, $a]])->assertStatus(422);
        $this->grade(['items' => [$a]])->assertStatus(422);
        $this->grade(['score' => 20, 'max_score' => 20])->assertStatus(422);

        $grade = $this->submission->fresh()->grade;
        $this->assertSame('12.00', (string) $grade->score);
        $this->assertSame(2, GradeItem::count());

        // Adding activities after the saved ones (and new feedback) is allowed.
        $this->grade(['items' => [$a, $b, ['title' => 'C', 'score' => 8, 'max_score' => 10]], 'feedback' => 'Better'])
            ->assertOk()
            ->assertJsonPath('grade.score', '20.00')
            ->assertJsonPath('grade.max_score', '30.00')
            ->assertJsonPath('grade.feedback', 'Better');
        $this->assertSame(3, GradeItem::count());
    }

    #[Group('FR-GF'), Group('FR-GF-01'), Group('FR-GF-04')]
    public function test_a_single_score_is_locked_and_can_gain_activities(): void
    {
        $this->grade(['score' => 45, 'max_score' => 50])->assertOk();

        // Sending the same single score again (e.g. only new feedback) is fine.
        $this->grade(['score' => 45, 'max_score' => 50, 'feedback' => 'Note'])->assertOk();
        $this->grade(['score' => 40, 'max_score' => 50])->assertStatus(422);

        // The single score becomes the first row; more rows can follow.
        $this->grade(['items' => [
            ['title' => 'Module activity', 'score' => 45, 'max_score' => 50],
            ['title' => 'Extra', 'score' => 10, 'max_score' => 10],
        ]])->assertOk()->assertJsonPath('grade.score', '55.00');
        $this->grade(['items' => [['title' => 'Module activity', 'score' => 30, 'max_score' => 50]]])->assertStatus(422);
    }

    #[Group('FR-GF'), Group('FR-GF-01')]
    public function test_invalid_rows_are_refused(): void
    {
        $this->grade(['items' => []])->assertStatus(422);
        $this->grade(['items' => [['title' => '', 'score' => 1, 'max_score' => 2]]])->assertStatus(422);
        $this->grade(['items' => [['title' => 'A', 'score' => 1, 'max_score' => 0]]])->assertStatus(422);
        $this->grade(['items' => [['title' => 'A', 'score' => -1, 'max_score' => 5]]])->assertStatus(422);
        $this->grade(['items' => [['title' => 'Too high', 'score' => 21, 'max_score' => 20]]])
            ->assertStatus(422)->assertJsonPath('message', 'The score of "Too high" cannot be greater than 20.');
        $this->grade(['items' => array_fill(0, 31, ['title' => 'A', 'score' => 1, 'max_score' => 1])])->assertStatus(422);

        $this->assertNull($this->submission->fresh()->grade);
    }

    private function confirmEdit(string $password, ?User $as = null)
    {
        return $this->actingAs($as ?? $this->instructor)
            ->postJson("/api/instructor/submissions/{$this->submission->id}/grade/confirm-edit", ['password' => $password]);
    }

    #[Group('FR-GF'), Group('FR-GF-04')]
    public function test_saved_scores_can_be_changed_after_password_confirmation(): void
    {
        $a = ['title' => 'A', 'score' => 5, 'max_score' => 10];
        $this->grade(['items' => [$a]])->assertOk();

        // Without confirming, the change is refused and the page is told to ask for the password.
        $this->grade(['items' => [['title' => 'A', 'score' => 9, 'max_score' => 10]]])
            ->assertStatus(422)
            ->assertJsonPath('password_required', true);

        // A wrong password does not unlock anything.
        $this->confirmEdit('wrong-password')->assertStatus(422)->assertJsonMissingPath('edit_pass');
        $this->grade(['items' => [['title' => 'A', 'score' => 9, 'max_score' => 10]], 'edit_pass' => 'made-up'])
            ->assertStatus(422);

        // The right password gives a one-time pass for this submission.
        $pass = $this->confirmEdit('password')->assertOk()->json('edit_pass');
        $this->assertNotEmpty($pass);

        $this->grade(['items' => [['title' => 'A (rechecked)', 'score' => 9, 'max_score' => 10]], 'edit_pass' => $pass])
            ->assertOk()
            ->assertJsonPath('grade.score', '9.00')
            ->assertJsonPath('grade.items.0.title', 'A (rechecked)');

        // The learner is told, and the change is in the audit log.
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->learner->id,
            'title' => 'Grade Updated',
        ]);
        $this->assertDatabaseHas('audit_logs', ['module' => 'Grades', 'action' => 'update']);

        // The pass works only once.
        $this->grade(['items' => [['title' => 'A', 'score' => 2, 'max_score' => 10]], 'edit_pass' => $pass])
            ->assertStatus(422)
            ->assertJsonPath('password_required', true);
        $this->assertSame('9.00', (string) $this->submission->fresh()->grade->score);
    }

    #[Group('FR-GF'), Group('NFR-S'), Group('FR-GF-04'), Group('NFR-S-02')]
    public function test_confirming_a_score_change_is_limited_to_the_class_instructor(): void
    {
        $this->grade(['items' => [['title' => 'A', 'score' => 5, 'max_score' => 10]]])->assertOk();

        $other = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-SC3', 'is_active' => true]);
        $this->confirmEdit('password', $other)->assertForbidden();
        $this->confirmEdit('password', $this->learner)->assertForbidden();

        // Five wrong passwords stop further tries for a while.
        for ($i = 0; $i < 5; $i++) {
            $this->confirmEdit('wrong-password')->assertStatus(422);
        }
        $this->confirmEdit('password')->assertStatus(429);
    }

    #[Group('FR-GF'), Group('NFR-S'), Group('FR-GF-01'), Group('NFR-S-02')]
    public function test_other_instructors_cannot_grade(): void
    {
        $other = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-SC2', 'is_active' => true]);
        $this->actingAs($other)
            ->postJson("/api/instructor/submissions/{$this->submission->id}/grade", ['items' => [['title' => 'A', 'score' => 1, 'max_score' => 2]]])
            ->assertForbidden();
    }
}
