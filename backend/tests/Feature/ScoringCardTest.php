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

    /** A second learner in the class with a submission for the same module. */
    private function secondSubmission(): Submission
    {
        $learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-SC002', 'is_active' => true]);
        $this->class->learners()->attach($learner->id);

        $this->actingAs($learner)->post('/api/student/submissions', [
            'module_id' => $this->module->id,
            'file' => UploadedFile::fake()->createWithContent('compiled2.pdf', '%PDF-1.4 all activities'),
        ], ['Accept' => 'application/json'])->assertCreated();

        return Submission::where('learner_id', $learner->id)->firstOrFail();
    }

    public function test_the_over_of_an_activity_must_be_a_whole_number(): void
    {
        $this->grade(['items' => [['title' => 'A', 'score' => 5, 'max_score' => 12.5]]])
            ->assertStatus(422)
            ->assertJsonValidationErrors('items.0.max_score');

        $this->grade(['items' => [['title' => 'A', 'score' => 5.5, 'max_score' => 12]]])->assertOk();
    }

    public function test_a_saved_card_becomes_the_module_activity_list(): void
    {
        $this->grade(['items' => [
            ['title' => 'Activity 1', 'score' => 8, 'max_score' => 10],
            ['title' => 'Activity 2', 'score' => 15, 'max_score' => 20],
        ]])->assertOk();

        $this->actingAs($this->instructor)
            ->getJson("/api/instructor/modules/{$this->module->id}/activities")
            ->assertOk()
            ->assertJsonPath('source', 'saved')
            ->assertJsonPath('activities', [
                ['title' => 'Activity 1', 'description' => null, 'max_score' => 10],
                ['title' => 'Activity 2', 'description' => null, 'max_score' => 20],
            ]);

        $other = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-SC4', 'is_active' => true]);
        $this->actingAs($other)
            ->getJson("/api/instructor/modules/{$this->module->id}/activities")
            ->assertNotFound();
    }

    public function test_activities_are_found_in_the_module_word_file(): void
    {
        if (!class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('The zip extension is not loaded.');
        }

        $path = Module::MATERIAL_FOLDER . 'lesson.docx';
        $file = tempnam(sys_get_temp_dir(), 'docx');
        $zip = new \ZipArchive();
        $zip->open($file, \ZipArchive::OVERWRITE);
        $zip->addFromString('word/document.xml', '<w:document xmlns:w="w"><w:body>'
            . '<w:p><w:r><w:t>Activity 1 – Introduction to Programming (20 points)</w:t></w:r></w:p>'
            . '<w:p><w:r><w:t>Write a short essay on what programming is.</w:t></w:r></w:p>'
            . '<w:p><w:r><w:t>Activity 2</w:t></w:r></w:p>'
            . '<w:p><w:r><w:t>Variables and Data Types</w:t></w:r></w:p>'
            . '<w:p><w:r><w:t>Declare five variables.</w:t></w:r></w:p>'
            . '<w:p><w:r><w:t>Quiz 3</w:t></w:r></w:p>'
            . '</w:body></w:document>');
        $zip->close();
        Storage::disk('local')->put($path, file_get_contents($file));
        $this->module->update(['material_path' => $path, 'material_name' => 'lesson.docx']);

        $this->actingAs($this->instructor)
            ->getJson("/api/instructor/modules/{$this->module->id}/activities")
            ->assertOk()
            ->assertJsonPath('source', 'detected')
            ->assertJsonPath('activities', [
                // The real names are kept, and no Over is taken from the file.
                ['title' => 'Introduction to Programming (20 points)', 'description' => 'Write a short essay on what programming is.', 'max_score' => null],
                ['title' => 'Variables and Data Types', 'description' => 'Declare five variables.', 'max_score' => null],
                ['title' => 'Quiz 3', 'description' => null, 'max_score' => null],
            ]);
    }

    private function saveActivities(Submission $submission, array $body)
    {
        return $this->actingAs($this->instructor)
            ->postJson("/api/instructor/submissions/{$submission->id}/activities", $body);
    }

    public function test_the_activity_list_can_be_saved_for_every_learner_before_grading(): void
    {
        $this->saveActivities($this->submission, ['activities' => [
            ['title' => 'Introduction to Programming', 'description' => 'Short essay', 'max_score' => 20],
            ['title' => 'Variables and Data Types', 'max_score' => 30],
            ['title' => 'Basic Programming Exercises', 'max_score' => null],
        ]])->assertOk();

        // Nobody was graded; another learner's card gets the same list.
        $this->assertNull($this->submission->fresh()->grade);
        $this->actingAs($this->instructor)
            ->getJson("/api/instructor/modules/{$this->module->id}/activities")
            ->assertJsonPath('source', 'saved')
            ->assertJsonPath('activities', [
                ['title' => 'Introduction to Programming', 'description' => 'Short essay', 'max_score' => 20],
                ['title' => 'Variables and Data Types', 'description' => null, 'max_score' => 30],
                ['title' => 'Basic Programming Exercises', 'description' => null, 'max_score' => null],
            ]);

        // Grading keeps the descriptions of the list.
        $this->grade(['items' => [
            ['title' => 'Introduction to Programming', 'score' => 18, 'max_score' => 20],
            ['title' => 'Variables and Data Types', 'score' => 25, 'max_score' => 30],
            ['title' => 'Basic Programming Exercises', 'score' => 45, 'max_score' => 50],
        ]])->assertOk();
        $this->assertDatabaseHas('module_activities', [
            'module_id' => $this->module->id, 'title' => 'Introduction to Programming', 'description' => 'Short essay',
        ]);
        $this->assertDatabaseHas('module_activities', [
            'module_id' => $this->module->id, 'title' => 'Basic Programming Exercises', 'max_score' => 50,
        ]);
    }

    public function test_saving_the_activity_list_with_a_new_over_updates_graded_learners_after_the_password(): void
    {
        $this->grade(['items' => [['title' => 'Activity 1', 'score' => 8, 'max_score' => 10]]])->assertOk();
        $second = $this->secondSubmission();
        $list = ['activities' => [['title' => 'Activity 1', 'max_score' => 25]]];

        $this->saveActivities($second, $list)->assertStatus(422)->assertJsonPath('password_required', true);
        $this->assertSame('10.00', (string) $this->submission->fresh()->grade->max_score);

        $pass = $this->actingAs($this->instructor)
            ->postJson("/api/instructor/submissions/{$second->id}/grade/confirm-edit", ['password' => 'password'])
            ->json('edit_pass');

        $this->saveActivities($second, $list + ['edit_pass' => $pass])->assertOk();
        $this->assertSame('8.00', (string) $this->submission->fresh()->grade->score);
        $this->assertSame('25.00', (string) $this->submission->fresh()->grade->max_score);

        // A score already given is never cut down to a lower Over.
        $this->saveActivities($second, ['activities' => [['title' => 'Activity 1', 'max_score' => 5]]])
            ->assertStatus(422)
            ->assertJsonMissingPath('password_required');
    }

    public function test_each_class_keeps_its_own_activity_list(): void
    {
        $this->saveActivities($this->submission, ['activities' => [['title' => 'Activity 1', 'max_score' => 20]]])->assertOk();

        // The same module assigned to another class is another module row.
        $otherClass = Course::create([
            'name' => 'Web Development B', 'code' => 'WEB-102', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $this->class->owner_admin_id,
        ]);
        $otherModule = Module::create(['course_id' => $otherClass->id, 'title' => 'Module 1', 'is_published' => true, 'module_order' => 1]);

        $this->actingAs($this->instructor)
            ->getJson("/api/instructor/modules/{$otherModule->id}/activities")
            ->assertOk()
            ->assertJsonPath('source', 'none')
            ->assertJsonPath('activities', []);
    }

    public function test_an_activity_cannot_be_listed_twice(): void
    {
        $this->saveActivities($this->submission, ['activities' => [
            ['title' => 'Activity 1', 'max_score' => 10],
            ['title' => 'activity 1 ', 'max_score' => 10],
        ]])->assertStatus(422);

        $this->grade(['items' => [
            ['title' => 'Activity 1', 'score' => 1, 'max_score' => 10],
            ['title' => 'ACTIVITY 1', 'score' => 1, 'max_score' => 10],
        ]])->assertStatus(422);

        $this->saveActivities($this->submission, ['activities' => [['title' => 'A', 'max_score' => 7.5]]])
            ->assertStatus(422);
    }

    public function test_other_instructors_cannot_save_the_activity_list(): void
    {
        $other = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-SC5', 'is_active' => true]);

        $this->actingAs($other)
            ->postJson("/api/instructor/submissions/{$this->submission->id}/activities", ['activities' => [['title' => 'A', 'max_score' => 10]]])
            ->assertForbidden();
    }

    public function test_a_changed_over_applies_to_every_learner_of_the_module(): void
    {
        $this->grade(['items' => [['title' => 'Activity 1', 'score' => 8, 'max_score' => 10]]])->assertOk();
        $second = $this->secondSubmission();
        $url = "/api/instructor/submissions/{$second->id}/grade";
        $card = ['items' => [['title' => 'activity 1', 'score' => 15, 'max_score' => 20]]];

        // It changes a score already given, so the password is asked first.
        $this->actingAs($this->instructor)->postJson($url, $card)
            ->assertStatus(422)
            ->assertJsonPath('password_required', true);
        $this->assertSame('10.00', (string) $this->submission->fresh()->grade->max_score);

        $pass = $this->actingAs($this->instructor)
            ->postJson("{$url}/confirm-edit", ['password' => 'password'])
            ->assertOk()
            ->json('edit_pass');

        $this->actingAs($this->instructor)->postJson($url, $card + ['edit_pass' => $pass])->assertOk();

        $first = $this->submission->fresh()->grade;
        $this->assertSame('8.00', (string) $first->score);
        $this->assertSame('20.00', (string) $first->max_score);
        $this->assertEquals(20, $first->items()->first()->max_score);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->learner->id, 'title' => 'Grade Updated']);
    }

    public function test_an_over_lower_than_a_score_already_given_is_refused(): void
    {
        $this->grade(['items' => [['title' => 'Activity 1', 'score' => 8, 'max_score' => 10]]])->assertOk();
        $second = $this->secondSubmission();

        $this->actingAs($this->instructor)
            ->postJson("/api/instructor/submissions/{$second->id}/grade", [
                'items' => [['title' => 'Activity 1', 'score' => 3, 'max_score' => 5]],
            ])
            ->assertStatus(422)
            ->assertJsonMissingPath('password_required');

        $this->assertNull($second->fresh()->grade);
        $this->assertSame('10.00', (string) $this->submission->fresh()->grade->max_score);
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
