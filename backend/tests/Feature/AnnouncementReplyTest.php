<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\AnnouncementReply;
use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class AnnouncementReplyTest extends TestCase
{
    use RefreshDatabase;

    private User $instructor;
    private User $otherInstructor;
    private User $learner;
    private User $classmate;
    private User $outsider;
    private Course $class;
    private Announcement $announcement;

    protected function setUp(): void
    {
        parent::setUp();

        $admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-RP', 'is_active' => true]);
        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-RP1', 'name' => 'Prof Reyes', 'is_active' => true]);
        $this->otherInstructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-RP2', 'is_active' => true]);
        $this->learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-RP001', 'name' => 'Ana Cruz', 'is_active' => true]);
        $this->classmate = User::factory()->create(['role' => 'learner', 'school_id' => '24-RP002', 'name' => 'Ben Lim', 'is_active' => true]);
        $this->outsider = User::factory()->create(['role' => 'learner', 'school_id' => '24-RP003', 'is_active' => true]);

        $this->class = Course::create([
            'name' => 'Web Development', 'code' => 'WEB-101', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $admin->id,
        ]);
        $this->class->learners()->attach([$this->learner->id, $this->classmate->id]);

        $this->announcement = $this->class->announcements()->create([
            'instructor_id' => $this->instructor->id, 'title' => 'Quiz on Friday', 'message' => 'Review modules 1 and 2.',
        ]);
    }

    private function learnerReply(User $learner, string $message = 'Noted, thank you!')
    {
        return $this->actingAs($learner)->postJson("/api/student/announcements/{$this->announcement->id}/replies", ['message' => $message]);
    }

    #[Group('FR-CA'), Group('FR-NM'), Group('FR-CA-02'), Group('FR-NM-04')]
    public function test_learner_replies_and_the_instructor_is_notified(): void
    {
        $this->learnerReply($this->learner)
            ->assertCreated()
            ->assertJsonPath('reply.message', 'Noted, thank you!')
            ->assertJsonPath('reply.author.name', 'Ana Cruz')
            ->assertJsonPath('reply.is_mine', true);

        $this->assertDatabaseHas('notifications', ['user_id' => $this->instructor->id, 'type' => 'announcement_reply']);
    }

    #[Group('FR-CA'), Group('FR-CA-02'), Group('FR-CA-03')]
    public function test_classmates_see_replies_on_the_class_page(): void
    {
        $this->learnerReply($this->learner);
        $this->actingAs($this->instructor)
            ->postJson("/api/instructor/announcements/{$this->announcement->id}/replies", ['message' => 'Good luck everyone.'])
            ->assertCreated()->assertJsonPath('reply.author.role', 'instructor');

        $this->actingAs($this->classmate)->getJson("/api/student/courses/{$this->class->id}")
            ->assertOk()
            ->assertJsonCount(2, 'course.announcements.0.replies')
            ->assertJsonPath('course.announcements.0.replies.0.author.name', 'Ana Cruz')
            ->assertJsonPath('course.announcements.0.replies.0.is_mine', false)
            ->assertJsonPath('course.announcements.0.replies.1.author.role', 'instructor');

        $this->actingAs($this->instructor)->getJson("/api/instructor/classes/{$this->class->id}/announcements")
            ->assertOk()
            ->assertJsonCount(2, 'announcements.0.replies')
            ->assertJsonPath('announcements.0.replies.1.is_mine', true);
    }

    #[Group('FR-CA'), Group('NFR-S'), Group('FR-CA-02'), Group('NFR-S-02')]
    public function test_only_enrolled_learners_in_active_classes_can_reply(): void
    {
        $this->learnerReply($this->outsider)->assertNotFound();
        $this->actingAs($this->instructor)->postJson("/api/student/announcements/{$this->announcement->id}/replies", ['message' => 'x'])->assertForbidden();

        $this->class->update(['is_active' => false]);
        $this->learnerReply($this->learner)->assertNotFound();

        $this->assertSame(0, AnnouncementReply::count());
    }

    #[Group('FR-CA'), Group('FR-CA-02')]
    public function test_empty_or_too_long_replies_are_refused(): void
    {
        $this->learnerReply($this->learner, '   ')->assertStatus(422)->assertJsonValidationErrors('message');
        $this->learnerReply($this->learner, str_repeat('a', 2001))->assertStatus(422)->assertJsonValidationErrors('message');
        $this->assertSame(0, AnnouncementReply::count());
    }

    #[Group('FR-CA'), Group('NFR-S'), Group('FR-CA-02'), Group('FR-CA-03'), Group('NFR-S-02')]
    public function test_learners_delete_only_their_own_replies_and_instructors_moderate_their_class(): void
    {
        $mine = $this->learnerReply($this->learner)->json('reply.id');
        $theirs = $this->learnerReply($this->classmate, 'Me too')->json('reply.id');

        $this->actingAs($this->learner)->deleteJson("/api/student/announcement-replies/{$theirs}")->assertNotFound();
        $this->actingAs($this->learner)->deleteJson("/api/student/announcement-replies/{$mine}")->assertOk();

        $this->actingAs($this->otherInstructor)->deleteJson("/api/instructor/announcement-replies/{$theirs}")->assertNotFound();
        $this->actingAs($this->instructor)->deleteJson("/api/instructor/announcement-replies/{$theirs}")->assertOk();

        $this->assertSame(0, AnnouncementReply::count());
    }

    #[Group('FR-CA'), Group('FR-CA-01')]
    public function test_replies_are_removed_with_the_announcement(): void
    {
        $this->learnerReply($this->learner);
        $this->actingAs($this->instructor)->deleteJson("/api/instructor/announcements/{$this->announcement->id}")->assertOk();
        $this->assertSame(0, AnnouncementReply::count());
    }
}
