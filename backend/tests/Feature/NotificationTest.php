<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Group;
use Tests\Concerns\BuildsClassroom;
use Tests\TestCase;

/**
 * Notification gaps. In-app notifications are rows in the notifications
 * table, so the tests check that table.
 */
#[Group('integration')]
class NotificationTest extends TestCase
{
    use RefreshDatabase;
    use BuildsClassroom;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->buildClassroom();
    }

    #[Group('FR-NM'), Group('FR-NM-01'), Group('discrepancy')]
    public function test_learner_is_notified_when_added_to_class(): void
    {
        $newcomer = User::factory()->create(['role' => 'learner', 'school_id' => '24-00060', 'is_active' => true, 'owner_admin_id' => $this->admin->id]);

        $this->actingAs($this->admin)->postJson("/api/admin/classes/{$this->class->id}/learners", ['learner_id' => $newcomer->id])
            ->assertSuccessful();

        if (Notification::where('user_id', $newcomer->id)->doesntExist()) {
            $this->requirementNotMet('FR-NM-01', 'adding a Learner to a Class creates no notification for the Learner.');
        }
        $this->assertTrue(Notification::where('user_id', $newcomer->id)->exists());
    }

    #[Group('FR-NM'), Group('FR-NM-01'), Group('discrepancy')]
    public function test_learner_is_notified_when_module_is_assigned_to_their_class(): void
    {
        $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2', 'is_published' => true]],
        ])->assertOk();

        if (Notification::where('user_id', $this->learner->id)->doesntExist()) {
            $this->requirementNotMet('FR-NM-01', 'assigning a Module to a Class creates no notification for its Learners.');
        }
        $this->assertTrue(Notification::where('user_id', $this->learner->id)->exists());
    }

    #[Group('FR-NM'), Group('FR-NM-02')]
    public function test_instructor_is_notified_when_learner_submits(): void
    {
        $this->submitAndGet();

        $this->assertTrue(Notification::where('user_id', $this->instructor->id)->exists());
        $this->assertFalse(Notification::where('user_id', $this->otherInstructor->id)->exists());
    }

    #[Group('FR-NM'), Group('FR-NM-03')]
    public function test_learner_is_notified_in_the_app_when_grade_is_posted(): void
    {
        $submission = $this->submitAndGet();
        $this->gradeSubmission($submission, ['score' => 9, 'max_score' => 10])->assertOk();

        $this->assertDatabaseHas('notifications', ['user_id' => $this->learner->id, 'type' => 'grade']);
    }

    #[Group('FR-NM'), Group('FR-NM-05'), Group('discrepancy')]
    public function test_academic_administrator_is_notified_when_saved_score_is_changed(): void
    {
        $submission = $this->submitAndGet();
        $url = "/api/instructor/submissions/{$submission->id}/grade";
        $this->actingAs($this->instructor)->postJson($url, ['items' => [['title' => 'A', 'score' => 5, 'max_score' => 10]]])->assertOk();

        $before = Notification::where('user_id', $this->admin->id)->count();

        $pass = $this->actingAs($this->instructor)->postJson("$url/confirm-edit", ['password' => 'password'])->assertOk()->json('edit_pass');
        $this->actingAs($this->instructor)->postJson($url, [
            'items' => [['title' => 'A', 'score' => 9, 'max_score' => 10]], 'edit_pass' => $pass,
        ])->assertOk();

        if (Notification::where('user_id', $this->admin->id)->count() === $before) {
            $this->requirementNotMet('FR-NM-05', 'the Academic Administrator is notified when work is first graded, but not when an Instructor changes a saved score. (The change is written to the audit log, and the Learner is notified.)');
        }
        $this->assertGreaterThan($before, Notification::where('user_id', $this->admin->id)->count());

        $latest = Notification::where('user_id', $this->admin->id)->latest('id')->first();
        $this->assertSame('Grade Updated', $latest->title);
        $this->assertSame('grade', $latest->type);
        $this->assertStringContainsString('from 5/10 to 9/10', $latest->message);
    }

    #[Group('FR-NM'), Group('NFR-S'), Group('FR-NM-07'), Group('NFR-S-02')]
    public function test_user_can_view_own_notification_history_only(): void
    {
        Notification::create(['user_id' => $this->learner->id, 'title' => 'For Ana', 'message' => 'Hello Ana', 'type' => 'announcement', 'is_read' => false]);
        Notification::create(['user_id' => $this->otherLearner->id, 'title' => 'For Ben', 'message' => 'Hello Ben', 'type' => 'announcement', 'is_read' => false]);

        $text = json_encode($this->actingAs($this->learner)->getJson('/api/student/notifications')->assertOk()->json());

        $this->assertStringContainsString('For Ana', $text);
        $this->assertStringNotContainsString('For Ben', $text);
    }
}
