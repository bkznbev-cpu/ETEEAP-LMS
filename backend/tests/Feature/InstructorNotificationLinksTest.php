<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\Course;
use App\Models\Module;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * Instructor notifications say what they are about (class, learner,
 * announcement) so clicking them opens the right place; learner photos
 * reach the class page; learner progress is per class.
 */
#[Group('integration')]
class InstructorNotificationLinksTest extends TestCase
{
    use RefreshDatabase;

    private User $instructor;
    private User $learner;
    private Course $web;
    private Course $math;
    private Module $webModule;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');

        $admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-NL', 'is_active' => true]);
        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-NL', 'name' => 'Prof Reyes', 'is_active' => true]);
        $this->learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-NL01', 'name' => 'Ana Cruz', 'is_active' => true]);

        $this->web = Course::create(['name' => 'Web Development', 'code' => 'WEB-101', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $admin->id]);
        $this->math = Course::create(['name' => 'Math', 'code' => 'MATH-1', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $admin->id]);
        $this->web->learners()->attach($this->learner->id);
        $this->math->learners()->attach($this->learner->id);

        $this->webModule = Module::create(['course_id' => $this->web->id, 'title' => 'HTML Basics', 'is_published' => true, 'module_order' => 1]);
        Module::create(['course_id' => $this->web->id, 'title' => 'Draft', 'is_published' => false, 'module_order' => 2]);
        Module::create(['course_id' => $this->math->id, 'title' => 'Algebra', 'is_published' => true, 'module_order' => 1]);
        Module::create(['course_id' => $this->math->id, 'title' => 'Geometry', 'is_published' => true, 'module_order' => 2]);
    }

    #[Group('FR-NM'), Group('FR-NM-02')]
    public function test_new_submission_notification_points_to_the_learner_in_the_class(): void
    {
        $this->actingAs($this->learner)->post('/api/student/submissions', [
            'module_id' => $this->webModule->id,
            'file' => UploadedFile::fake()->createWithContent('work.pdf', '%PDF-1.4 work'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->actingAs($this->instructor)->getJson('/api/instructor/notifications')
            ->assertOk()
            ->assertJsonPath('notifications.0.title', 'New Submission')
            ->assertJsonPath('notifications.0.data.course_id', $this->web->id)
            ->assertJsonPath('notifications.0.data.learner_id', $this->learner->id)
            ->assertJsonPath('notifications.0.data.module_id', $this->webModule->id);
    }

    #[Group('FR-NM'), Group('FR-NM-04')]
    public function test_learner_reply_notifies_the_instructor_with_the_announcement(): void
    {
        $announcement = Announcement::create([
            'course_id' => $this->web->id, 'instructor_id' => $this->instructor->id,
            'title' => 'Quiz on Friday', 'message' => 'Bring a pen.',
        ]);

        $this->actingAs($this->learner)
            ->postJson("/api/student/announcements/{$announcement->id}/replies", ['message' => 'Noted, sir!'])
            ->assertSuccessful();

        $note = Notification::where('user_id', $this->instructor->id)->latest('id')->first();
        $this->assertSame('announcement_reply', $note->type);
        $this->assertStringContainsString('Ana Cruz replied to "Quiz on Friday"', $note->message);
        $this->assertSame($this->web->id, $note->data['course_id']);
        $this->assertSame($announcement->id, $note->data['announcement_id']);
    }

    #[Group('FR-CM'), Group('FR-CM-07')]
    public function test_class_learners_include_their_profile_photo(): void
    {
        $this->actingAs($this->learner)->post('/api/student/profile/photo', [
            'photo' => UploadedFile::fake()->image('me.png', 50, 50),
        ], ['Accept' => 'application/json'])->assertOk();

        $url = $this->actingAs($this->instructor)->getJson("/api/instructor/classes/{$this->web->id}")
            ->assertOk()
            ->json('class.learners.0.profile_photo_url');

        $this->assertNotNull($url);
        $this->assertStringContainsString('profile-photos/', $url);
    }

    #[Group('FR-PT'), Group('FR-PT-02')]
    public function test_learner_progress_has_one_row_per_class(): void
    {
        $rows = collect($this->actingAs($this->instructor)->getJson('/api/instructor/dashboard')
            ->assertOk()
            ->json('learners'));

        $this->assertCount(2, $rows);
        $web = $rows->firstWhere('class_code', 'WEB-101');
        $math = $rows->firstWhere('class_code', 'MATH-1');

        $this->assertSame('Ana Cruz', $web['name']);
        $this->assertSame($this->web->id, $web['class_id']);
        $this->assertSame('Web Development', $web['class_name']);
        $this->assertSame(1, $web['modules_assigned']); // published only
        $this->assertSame(2, $math['modules_assigned']);
    }
}
