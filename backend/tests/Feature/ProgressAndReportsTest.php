<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Group;
use Tests\Concerns\BuildsClassroom;
use Tests\TestCase;

/**
 * Progress, work queue, learner list and dashboard data. Report CSV export
 * and printing happen in the browser and are not tested here.
 */
#[Group('integration')]
class ProgressAndReportsTest extends TestCase
{
    use RefreshDatabase;
    use BuildsClassroom;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->buildClassroom();
    }

    #[Group('FR-PT'), Group('FR-PT-01')]
    public function test_learner_sees_correct_status_for_graded_waiting_and_not_submitted_modules(): void
    {
        $waiting = Module::create(['course_id' => $this->class->id, 'title' => 'Module 2', 'is_published' => true, 'module_order' => 2]);
        $notSubmitted = Module::create(['course_id' => $this->class->id, 'title' => 'Module 3', 'is_published' => true, 'module_order' => 3]);

        $graded = $this->submitAndGet();
        $this->gradeSubmission($graded, ['score' => 9, 'max_score' => 10])->assertOk();
        $this->submitAndGet(module: $waiting);

        $modules = collect($this->actingAs($this->learner)->getJson("/api/student/courses/{$this->class->id}")
            ->assertOk()->json('course.modules'))->keyBy('id');

        $this->assertSame('graded', $modules[$this->module->id]['my_submission']['status']);
        $this->assertSame('submitted', $modules[$waiting->id]['my_submission']['status']);
        $this->assertNull($modules[$notSubmitted->id]['my_submission']);
    }

    #[Group('FR-PT'), Group('NFR-S'), Group('FR-PT-02'), Group('NFR-S-02')]
    public function test_instructor_sees_completion_for_learners_in_their_classes_only(): void
    {
        $this->submitAndGet();
        $this->submitAndGet($this->otherLearner, $this->otherModule);

        $text = json_encode($this->actingAs($this->instructor)->getJson("/api/instructor/classes/{$this->class->id}")->assertOk()->json());

        $this->assertStringContainsString('Ana Cruz', $text);
        $this->assertStringNotContainsString('Ben Santos', $text);
    }

    #[Group('FR-PT'), Group('FR-PT-03')]
    public function test_work_queue_data_shows_learners_without_class_ungraded_work_and_empty_classes(): void
    {
        User::factory()->create(['role' => 'learner', 'school_id' => '24-00077', 'name' => 'Lone Learner', 'is_active' => true, 'owner_admin_id' => $this->admin->id]);
        Course::create(['name' => 'Empty Class', 'code' => 'EMPTY-1', 'is_active' => true, 'owner_admin_id' => $this->admin->id]);
        $this->submitAndGet();

        $this->actingAs($this->admin)->getJson('/api/admin/dashboard')
            ->assertOk()->assertJsonPath('statistics.awaiting_grade', 1);

        $classes = collect($this->actingAs($this->admin)->getJson('/api/admin/classes')->assertOk()->json('classes'));
        $this->assertSame(0, $classes->firstWhere('code', 'EMPTY-1')['learners_count']);

        $enrolledIds = $classes->flatMap(fn ($c) => collect($c['learners'])->pluck('id'));
        $lone = User::where('school_id', '24-00077')->value('id');
        $this->assertNotContains($lone, $enrolledIds);
    }

    #[Group('FR-PT'), Group('FR-PT-05')]
    public function test_learner_list_shows_program_modules_progress_and_status(): void
    {
        $learners = collect($this->actingAs($this->admin)->getJson('/api/admin/learners')->assertOk()->json('learners'));
        $ana = $learners->firstWhere('school_id', '24-00001');

        $this->assertSame('BSCRIM', $ana['program']);
        $this->assertSame(1, $ana['modules_assigned']);
        $this->assertArrayHasKey('progress', $ana);
        $this->assertTrue($ana['is_active']);
        $this->assertArrayHasKey('last_activity', $ana);
    }

    #[Group('FR-PT'), Group('FR-PT-06')]
    public function test_dashboard_counts_are_correct(): void
    {
        $this->otherClass->update(['is_active' => false]);
        $this->submitAndGet();

        $this->actingAs($this->admin)->getJson('/api/admin/dashboard')->assertOk()
            ->assertJsonPath('statistics.learners', 2)
            ->assertJsonPath('statistics.instructors', 2)
            ->assertJsonPath('statistics.classes', 2)
            ->assertJsonPath('statistics.active_classes', 1)
            ->assertJsonPath('statistics.awaiting_grade', 1);
    }

    #[Group('FR-PT'), Group('FR-PT-04')]
    public function test_reports_endpoint_returns_class_and_learner_data(): void
    {
        $text = json_encode($this->actingAs($this->admin)->getJson('/api/admin/reports')->assertOk()->json());

        $this->assertStringContainsString('CRIM-101', $text);
        $this->assertStringContainsString('Ana Cruz', $text);
    }

    #[Group('FR-PT'), Group('NFR-S'), Group('FR-PT-04'), Group('FR-PT-06'), Group('NFR-S-02')]
    public function test_non_administrators_cannot_access_reports_or_dashboard(): void
    {
        foreach ([$this->learner, $this->instructor] as $user) {
            $this->actingAs($user)->getJson('/api/admin/reports')->assertForbidden();
            $this->actingAs($user)->getJson('/api/admin/dashboard')->assertForbidden();
            $this->actingAs($user)->getJson('/api/admin/learners')->assertForbidden();
        }
    }
}
