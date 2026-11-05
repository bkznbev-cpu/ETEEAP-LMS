<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Module;
use App\Models\Notification;
use App\Models\User;
use App\Support\AdminNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * All Academic Admins share the same learners, instructors, classes and
 * modules. owner_admin_id only records who created each one.
 */
#[Group('integration')]
class AcademicAdminSharedDataTest extends TestCase
{
    use RefreshDatabase;

    private User $adminA;
    private User $adminB;
    private User $learnerA;
    private User $instructorA;
    private Course $classA;
    private Module $moduleA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminA = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-A', 'is_active' => true]);
        $this->adminB = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-B', 'is_active' => true]);

        $this->learnerA = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-10001', 'is_active' => true,
            'owner_admin_id' => $this->adminA->id,
            'password' => Hash::make('learner-pass'),
        ]);
        $this->instructorA = User::factory()->create([
            'role' => 'instructor', 'school_id' => 'INS-A', 'email' => 'ins.a@x.edu', 'is_active' => true,
            'owner_admin_id' => $this->adminA->id,
        ]);
        $this->classA = Course::create([
            'name' => 'Class of A', 'code' => 'A-101', 'is_active' => true,
            'instructor_id' => $this->instructorA->id,
            'owner_admin_id' => $this->adminA->id,
        ]);
        $this->classA->learners()->attach($this->learnerA->id);
        $this->moduleA = Module::create(['course_id' => $this->classA->id, 'title' => 'Module of A']);
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    public function test_every_admin_sees_the_same_records(): void
    {
        foreach ([$this->adminA, $this->adminB] as $admin) {
            $this->actingAs($admin)->getJson('/api/admin/learners')->assertOk()->assertJsonCount(1, 'learners');
            $this->actingAs($admin)->getJson('/api/admin/instructors')->assertOk()->assertJsonCount(1, 'instructors');
            $this->actingAs($admin)->getJson('/api/admin/classes')->assertOk()->assertJsonCount(1, 'classes');
            $this->actingAs($admin)->getJson("/api/admin/classes/{$this->classA->id}/learners")->assertOk();
            $this->actingAs($admin)->getJson("/api/admin/classes/{$this->classA->id}/modules")->assertOk();

            $this->actingAs($admin)->getJson('/api/admin/dashboard')->assertOk()
                ->assertJsonPath('statistics.learners', 1)
                ->assertJsonPath('statistics.instructors', 1)
                ->assertJsonPath('statistics.classes', 1)
                ->assertJsonPath('statistics.active_classes', 1);
        }
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    public function test_any_admin_can_change_records_another_admin_created(): void
    {
        $b = $this->actingAs($this->adminB);

        $b->putJson("/api/admin/learners/{$this->learnerA->id}", ['name' => 'Renamed Learner'])->assertOk();
        $b->putJson("/api/admin/instructors/{$this->instructorA->id}", ['name' => 'Renamed Instructor'])->assertOk();
        $b->putJson("/api/admin/classes/{$this->classA->id}", ['name' => 'Renamed Class'])->assertOk();

        $this->assertDatabaseHas('users', ['id' => $this->learnerA->id, 'name' => 'Renamed Learner']);
        $this->assertDatabaseHas('users', ['id' => $this->instructorA->id, 'name' => 'Renamed Instructor']);
        $this->assertDatabaseHas('courses', ['id' => $this->classA->id, 'name' => 'Renamed Class']);
    }

    #[Group('FR-CM'), Group('FR-CM-02'), Group('FR-CM-03')]
    public function test_any_admin_can_use_another_admins_learner_or_instructor(): void
    {
        $classB = Course::create([
            'name' => 'Class of B', 'code' => 'B-101', 'is_active' => true,
            'owner_admin_id' => $this->adminB->id,
        ]);

        $this->actingAs($this->adminB)
            ->postJson("/api/admin/classes/{$classB->id}/learners", ['learner_id' => $this->learnerA->id])
            ->assertSuccessful();

        $this->actingAs($this->adminB)
            ->putJson("/api/admin/classes/{$classB->id}", ['instructor_id' => $this->instructorA->id])
            ->assertOk();

        $this->assertDatabaseHas('course_user', ['course_id' => $classB->id, 'user_id' => $this->learnerA->id]);
        $this->assertDatabaseHas('courses', ['id' => $classB->id, 'instructor_id' => $this->instructorA->id]);
    }

    #[Group('FR-UM'), Group('FR-UM-01')]
    public function test_new_records_remember_who_created_them_and_everyone_sees_them(): void
    {
        $this->actingAs($this->adminB)->postJson('/api/admin/learners', [
            'name' => 'Learner of B', 'school_id' => '24-20001', 'password' => 'temporary-1',
        ])->assertSuccessful();

        $this->actingAs($this->adminB)->postJson('/api/admin/classes', [
            'name' => 'Class of B', 'code' => 'B-201',
        ])->assertSuccessful();

        $this->assertDatabaseHas('users', ['school_id' => '24-20001', 'owner_admin_id' => $this->adminB->id]);
        $this->assertDatabaseHas('courses', ['code' => 'B-201', 'owner_admin_id' => $this->adminB->id]);

        $this->actingAs($this->adminA)->getJson('/api/admin/learners')->assertJsonCount(2, 'learners');
        $this->actingAs($this->adminA)->getJson('/api/admin/classes')->assertJsonCount(2, 'classes');
    }

    #[Group('FR-UM'), Group('FR-CM'), Group('FR-UM-01'), Group('FR-CM-01')]
    public function test_school_ids_and_class_codes_stay_unique_across_admins(): void
    {
        $this->actingAs($this->adminB)->postJson('/api/admin/learners', [
            'name' => 'Duplicate', 'school_id' => '24-10001', 'password' => 'temporary-1',
        ])->assertStatus(422);

        $this->actingAs($this->adminB)->postJson('/api/admin/classes', [
            'name' => 'Duplicate', 'code' => 'A-101',
        ])->assertStatus(422);
    }

    #[Group('FR-NM'), Group('FR-NM-05')]
    public function test_notifications_about_a_learner_go_to_every_admin(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['school_id' => '24-10001', 'password' => 'wrong-' . $i]);
        }

        $this->assertSame(1, Notification::where('user_id', $this->adminA->id)->where('type', 'account_locked')->count());
        $this->assertSame(1, Notification::where('user_id', $this->adminB->id)->where('type', 'account_locked')->count());
    }

    #[Group('FR-NM'), Group('FR-NM-05')]
    public function test_older_notifications_are_shared_with_every_admin_once(): void
    {
        Notification::create([
            'user_id' => $this->adminA->id, 'title' => 'Activity Graded',
            'message' => 'Old grade notice', 'type' => 'grade', 'is_read' => false,
        ]);

        $this->assertSame(1, AdminNotifier::shareAcademicAdminHistory($this->adminB));
        // Running it again doesn't make duplicates, either way round.
        $this->assertSame(0, AdminNotifier::shareAcademicAdminHistory($this->adminB));
        $this->assertSame(0, AdminNotifier::shareAcademicAdminHistory($this->adminA));

        $this->actingAs($this->adminB)->getJson('/api/admin/notifications')->assertOk()
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('notifications.0.message', 'Old grade notice')
            ->assertJsonPath('notifications.0.is_read', true);
    }

    #[Group('FR-NM'), Group('FR-NM-05')]
    public function test_a_new_admin_gets_the_same_notifications(): void
    {
        Notification::create([
            'user_id' => $this->adminA->id, 'title' => 'Account Locked',
            'message' => 'Old lock notice', 'type' => 'account_locked', 'is_read' => false,
        ]);
        $systemAdmin = User::factory()->create(['role' => 'system_admin', 'school_id' => 'SYS-NEW', 'is_active' => true]);

        $this->actingAs($systemAdmin)->postJson('/api/system-admin/academic-administrators', [
            'name' => 'Admin C', 'school_id' => 'ADM-C', 'email' => 'admin.c@x.edu', 'password' => 'Temporary-pass-1',
            'password_confirmation' => 'Temporary-pass-1',
        ])->assertSuccessful();

        $adminC = User::where('school_id', 'ADM-C')->firstOrFail();
        $this->assertSame(1, Notification::where('user_id', $adminC->id)->where('message', 'Old lock notice')->count());
    }

    #[Group('FR-UM'), Group('FR-UM-04')]
    public function test_an_admin_who_created_records_cannot_be_deleted(): void
    {
        $systemAdmin = User::factory()->create(['role' => 'system_admin', 'school_id' => 'SYS-SEP', 'is_active' => true]);

        $this->actingAs($systemAdmin)
            ->deleteJson("/api/system-admin/academic-administrators/{$this->adminA->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('users', ['id' => $this->adminA->id]);
    }
}
