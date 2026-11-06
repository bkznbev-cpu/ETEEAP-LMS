<?php

namespace Tests\Feature;

use App\Mail\AnnouncementPosted;
use App\Models\Announcement;
use App\Models\Course;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class InstructorAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    private User $instructor;
    private User $otherInstructor;
    private User $learner;
    private User $outsider;
    private Course $class;

    protected function setUp(): void
    {
        parent::setUp();

        $admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-AN', 'is_active' => true]);
        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-AN1', 'name' => 'Prof Reyes', 'is_active' => true]);
        $this->otherInstructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-AN2', 'is_active' => true]);
        $this->learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-AN001', 'is_active' => true]);
        $this->outsider = User::factory()->create(['role' => 'learner', 'school_id' => '24-AN002', 'is_active' => true]);

        $this->class = Course::create([
            'name' => 'Web Development', 'code' => 'WEB-101', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $admin->id,
        ]);
        $this->class->learners()->attach($this->learner->id);
    }

    private function postAnnouncement(array $data = ['title' => 'Quiz on Friday', 'message' => 'Review modules 1 and 2.'])
    {
        return $this->actingAs($this->instructor)
            ->postJson("/api/instructor/classes/{$this->class->id}/announcements", $data);
    }

    #[Group('FR-CA'), Group('FR-NM'), Group('FR-CA-01'), Group('FR-NM-04')]
    public function test_instructor_posts_and_enrolled_learners_are_notified(): void
    {
        $this->postAnnouncement()->assertCreated()
            ->assertJsonPath('announcement.title', 'Quiz on Friday')
            ->assertJsonPath('announcement.instructor.name', 'Prof Reyes');

        $this->assertDatabaseHas('notifications', ['user_id' => $this->learner->id, 'type' => 'announcement']);
        $this->assertSame(0, Notification::where('user_id', $this->outsider->id)->count());

        $this->actingAs($this->instructor)
            ->getJson("/api/instructor/classes/{$this->class->id}/announcements")
            ->assertOk()->assertJsonCount(1, 'announcements');
    }

    #[Group('FR-NM'), Group('FR-NM-04')]
    public function test_learners_with_an_email_get_the_announcement_by_email(): void
    {
        Mail::fake();
        $this->learner->update(['email' => 'ana@example.com']);
        $noEmail = User::factory()->create(['role' => 'learner', 'school_id' => '24-AN003', 'is_active' => true, 'email' => null]);
        $inactive = User::factory()->create(['role' => 'learner', 'school_id' => '24-AN004', 'is_active' => false, 'email' => 'off@example.com']);
        $this->outsider->update(['email' => 'outsider@example.com']);
        $this->class->learners()->attach([$noEmail->id, $inactive->id]);

        $this->postAnnouncement()->assertCreated();

        Mail::assertSent(AnnouncementPosted::class, 1);
        Mail::assertSent(AnnouncementPosted::class, function (AnnouncementPosted $mail) {
            $html = $mail->render();

            return $mail->hasBcc('ana@example.com')
                && !$mail->hasBcc('off@example.com')
                && !$mail->hasBcc('outsider@example.com')
                && $mail->hasSubject('New announcement in Web Development: Quiz on Friday')
                && str_contains($html, 'Review modules 1 and 2.')
                && str_contains($html, 'Prof Reyes')
                && str_contains($html, '/student/modules.html?course=' . $this->class->id . '#announcements');
        });
    }

    #[Group('FR-CA'), Group('FR-CA-01')]
    public function test_announcement_is_posted_even_if_the_email_fails(): void
    {
        $this->learner->update(['email' => 'ana@example.com']);
        Mail::shouldReceive('bcc')->andThrow(new \RuntimeException('SMTP down'));

        $this->postAnnouncement()->assertCreated();
        $this->assertSame(1, Announcement::count());
    }

    #[Group('FR-NM'), Group('FR-NM-04')]
    public function test_no_email_when_no_learner_has_an_address(): void
    {
        Mail::fake();
        $this->learner->update(['email' => null]);

        $this->postAnnouncement()->assertCreated();
        Mail::assertNothingSent();
    }

    #[Group('FR-CA'), Group('FR-CA-01')]
    public function test_title_and_message_are_required(): void
    {
        $this->postAnnouncement(['title' => '', 'message' => ''])
            ->assertStatus(422)->assertJsonValidationErrors(['title', 'message']);
    }

    #[Group('FR-CA'), Group('FR-CA-01')]
    public function test_edit_and_delete(): void
    {
        $id = $this->postAnnouncement()->json('announcement.id');

        $this->actingAs($this->instructor)
            ->putJson("/api/instructor/announcements/{$id}", ['title' => 'Quiz moved', 'message' => 'Now on Monday.'])
            ->assertOk()->assertJsonPath('announcement.title', 'Quiz moved');

        $this->actingAs($this->instructor)->deleteJson("/api/instructor/announcements/{$id}")->assertOk();
        $this->assertSame(0, Announcement::count());
    }

    #[Group('FR-CA'), Group('NFR-S'), Group('FR-CA-01'), Group('NFR-S-02')]
    public function test_other_instructors_and_learners_cannot_manage_it(): void
    {
        $id = $this->postAnnouncement()->json('announcement.id');

        $this->actingAs($this->otherInstructor)
            ->postJson("/api/instructor/classes/{$this->class->id}/announcements", ['title' => 'x', 'message' => 'y'])
            ->assertNotFound();
        $this->actingAs($this->otherInstructor)->getJson("/api/instructor/classes/{$this->class->id}/announcements")->assertNotFound();
        $this->actingAs($this->otherInstructor)->putJson("/api/instructor/announcements/{$id}", ['title' => 'x', 'message' => 'y'])->assertNotFound();
        $this->actingAs($this->otherInstructor)->deleteJson("/api/instructor/announcements/{$id}")->assertNotFound();
        $this->actingAs($this->learner)->deleteJson("/api/instructor/announcements/{$id}")->assertForbidden();

        $this->assertSame(1, Announcement::count());
    }

    #[Group('FR-CA'), Group('FR-CA-02')]
    public function test_enrolled_learner_sees_announcements_on_the_class(): void
    {
        $this->postAnnouncement();

        $this->actingAs($this->learner)->getJson("/api/student/courses/{$this->class->id}")
            ->assertOk()
            ->assertJsonPath('course.announcements.0.title', 'Quiz on Friday')
            ->assertJsonPath('course.announcements.0.instructor.name', 'Prof Reyes');

        $this->actingAs($this->outsider)->getJson("/api/student/courses/{$this->class->id}")->assertNotFound();
    }
}
