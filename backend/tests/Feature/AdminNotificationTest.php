<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Module;
use App\Models\Notification;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class AdminNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $schoolId, array $extra = []): User
    {
        return User::factory()->create(array_merge([
            'role' => $role,
            'school_id' => $schoolId,
            'name' => "{$role} {$schoolId}",
            'password' => Hash::make('the-password'),
            'is_active' => true,
        ], $extra));
    }

    private function notificationsFor(User $user)
    {
        return Notification::where('user_id', $user->id)->orderBy('id')->get();
    }

    #[Group('FR-NM'), Group('FR-NM-05')]
    public function test_admins_are_not_notified_when_a_learner_finishes_password_setup(): void
    {
        $adminA = $this->user('academic_admin', 'ADM-N1');
        $systemAdmin = $this->user('system_admin', 'SYS-N1');
        $this->user('learner', '24-10001', ['password_setup_complete' => false]);

        $token = $this->postJson('/api/login', [
            'school_id' => '24-10001',
            'password' => 'the-password',
            'agree_terms' => true,
        ])->assertOk()->json('token');

        $this->withToken($token)
            ->postJson('/api/student/setup-password', [
                'password' => 'learner-own-pass',
                'password_confirmation' => 'learner-own-pass',
            ])
            ->assertOk();

        $this->assertCount(0, $this->notificationsFor($adminA));
        $this->assertCount(0, $this->notificationsFor($systemAdmin));
    }

    #[Group('FR-NM'), Group('FR-NM-07')]
    public function test_old_account_setup_notifications_are_hidden_from_admins(): void
    {
        $admin = $this->user('academic_admin', 'ADM-N9');

        Notification::insert([
            ['user_id' => $admin->id, 'title' => 'Account Now in Use', 'message' => 'old', 'type' => 'account_setup', 'is_read' => false, 'created_at' => now(), 'updated_at' => now()],
            ['user_id' => $admin->id, 'title' => 'Account Locked', 'message' => 'kept', 'type' => 'account_locked', 'is_read' => false, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('notifications.0.type', 'account_locked');
    }

    #[Group('FR-NM'), Group('FR-NM-05')]
    public function test_academic_admins_are_told_when_work_is_graded_once(): void
    {
        $admin = $this->user('academic_admin', 'ADM-N4');
        $instructor = $this->user('instructor', 'INS-N1', ['name' => 'Prof Reyes']);
        $learner = $this->user('learner', '24-10002', ['name' => 'Ana Cruz']);

        $course = Course::create([
            'name' => 'Web Development',
            'code' => 'WEB-101',
            'instructor_id' => $instructor->id,
            'is_active' => true,
        ]);
        $module = Module::create(['course_id' => $course->id, 'title' => 'HTML Basics']);
        $submission = Submission::create([
            'module_id' => $module->id,
            'learner_id' => $learner->id,
            'status' => 'submitted',
        ]);

        $grade = fn (int $score, ?string $feedback = null) => $this->actingAs($instructor)
            ->postJson("/api/instructor/submissions/{$submission->id}/grade", [
                'score' => $score,
                'max_score' => 100,
                'feedback' => $feedback,
            ])
            ->assertSuccessful();

        $grade(95);
        // Saving again (the score can't change, only e.g. the feedback)
        // doesn't notify again.
        $grade(95, 'Well done');

        $notes = $this->notificationsFor($admin);
        $this->assertCount(1, $notes);
        $this->assertSame('grade', $notes[0]->type);
        $this->assertSame(
            'Prof Reyes graded Ana Cruz\'s "HTML Basics" in Web Development: 95/100.',
            $notes[0]->message
        );
    }

    #[Group('FR-NM'), Group('FR-NM-05'), Group('FR-NM-06')]
    public function test_lockout_notifies_the_right_admins_once(): void
    {
        $academicAdmin = $this->user('academic_admin', 'ADM-N5');
        $systemAdmin = $this->user('system_admin', 'SYS-N2');
        $this->user('learner', '24-10003');
        $this->user('academic_admin', 'ADM-N6');

        $fail = fn (string $id) => $this->postJson('/api/login', [
            'school_id' => $id,
            'password' => 'wrong-password',
        ]);

        // Learner locked: Academic Admins hear about it, once.
        for ($i = 0; $i < 7; $i++) {
            $fail('24-10003');
        }

        $this->assertCount(1, $this->notificationsFor($academicAdmin));
        $this->assertSame('account_locked', $this->notificationsFor($academicAdmin)[0]->type);
        $this->assertCount(0, $this->notificationsFor($systemAdmin));

        // Academic Admin locked: System Admins hear about it.
        for ($i = 0; $i < 5; $i++) {
            $fail('ADM-N6');
        }

        $this->assertCount(1, $this->notificationsFor($systemAdmin));
        $this->assertStringContainsString('ADM-N6', $this->notificationsFor($systemAdmin)[0]->message);

        // Unknown IDs don't notify anyone.
        for ($i = 0; $i < 5; $i++) {
            $fail('NOBODY');
        }

        $this->assertCount(1, $this->notificationsFor($academicAdmin));
        $this->assertCount(1, $this->notificationsFor($systemAdmin));
    }

    #[Group('FR-NM'), Group('FR-NM-06')]
    public function test_system_admins_are_told_about_academic_admin_account_changes(): void
    {
        $systemAdmin = $this->user('system_admin', 'SYS-N3', ['name' => 'Root Admin']);
        $otherSystemAdmin = $this->user('system_admin', 'SYS-N4');
        $this->user('academic_admin', 'ADM-N7'); // keeps one active Academic Admin

        $this->actingAs($systemAdmin)
            ->postJson('/api/system-admin/academic-administrators', [
                'name' => 'New Admin',
                'school_id' => 'ADM-N8',
                'password' => 'initial-password',
                'password_confirmation' => 'initial-password',
            ])
            ->assertCreated();
        $id = User::where('school_id', 'ADM-N8')->value('id');

        $this->actingAs($systemAdmin)
            ->putJson("/api/system-admin/academic-administrators/{$id}", ['name' => 'Renamed Admin'])
            ->assertOk(); // a plain edit: no notification
        $this->actingAs($systemAdmin)
            ->putJson("/api/system-admin/academic-administrators/{$id}", ['is_active' => false])
            ->assertOk();
        $this->actingAs($systemAdmin)
            ->deleteJson("/api/system-admin/academic-administrators/{$id}")
            ->assertOk();

        foreach ([$systemAdmin, $otherSystemAdmin] as $admin) {
            $titles = $this->notificationsFor($admin)->pluck('title')->all();
            $this->assertSame([
                'Academic Admin Account Created',
                'Academic Admin Account Deactivated',
                'Academic Admin Account Deleted',
            ], $titles);
        }

        $this->assertSame(
            'Root Admin created the Academic Admin account New Admin (ADM-N8).',
            $this->notificationsFor($systemAdmin)[0]->message
        );
    }

    #[Group('FR-NM'), Group('FR-NM-07')]
    public function test_system_admin_can_read_and_manage_their_own_notifications(): void
    {
        $systemAdmin = $this->user('system_admin', 'SYS-N5');
        $other = $this->user('system_admin', 'SYS-N6');

        $mine = Notification::create(['user_id' => $systemAdmin->id, 'title' => 'A', 'message' => 'a', 'type' => 'x']);
        Notification::create(['user_id' => $systemAdmin->id, 'title' => 'B', 'message' => 'b', 'type' => 'x']);
        $theirs = Notification::create(['user_id' => $other->id, 'title' => 'C', 'message' => 'c', 'type' => 'x']);

        $this->actingAs($systemAdmin)
            ->getJson('/api/system-admin/notifications')
            ->assertOk()
            ->assertJsonCount(2, 'notifications')
            ->assertJsonPath('notifications.0.title', 'B');

        $this->actingAs($systemAdmin)->patchJson("/api/system-admin/notifications/{$mine->id}/read")->assertOk();
        $this->assertTrue($mine->fresh()->is_read);

        $this->actingAs($systemAdmin)->patchJson("/api/system-admin/notifications/{$theirs->id}/read")->assertNotFound();
        $this->actingAs($systemAdmin)->deleteJson("/api/system-admin/notifications/{$theirs->id}")->assertNotFound();

        $this->actingAs($systemAdmin)->postJson('/api/system-admin/notifications/read-all')->assertOk();
        $this->assertSame(0, Notification::where('user_id', $systemAdmin->id)->where('is_read', false)->count());
        $this->assertFalse($theirs->fresh()->is_read);

        $this->actingAs($systemAdmin)->deleteJson("/api/system-admin/notifications/{$mine->id}")->assertOk();
        $this->assertNull($mine->fresh());
    }

    #[Group('FR-NM'), Group('NFR-S'), Group('FR-NM-07'), Group('NFR-S-02')]
    public function test_academic_admin_can_mark_all_read_and_learners_cannot_use_admin_endpoints(): void
    {
        $admin = $this->user('academic_admin', 'ADM-N9');
        $learner = $this->user('learner', '24-10004');
        Notification::create(['user_id' => $admin->id, 'title' => 'A', 'message' => 'a', 'type' => 'x']);

        $this->actingAs($admin)->postJson('/api/admin/notifications/read-all')->assertOk();
        $this->assertSame(0, Notification::where('user_id', $admin->id)->where('is_read', false)->count());

        $this->actingAs($learner)->getJson('/api/admin/notifications')->assertForbidden();
        $this->actingAs($learner)->getJson('/api/system-admin/notifications')->assertForbidden();
    }
}
