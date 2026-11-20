<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Group;
use Tests\Concerns\BuildsClassroom;
use Tests\TestCase;

/**
 * Class Management gaps not covered by the older admin and portal tests.
 */
#[Group('integration')]
class ClassManagementTest extends TestCase
{
    use RefreshDatabase;
    use BuildsClassroom;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildClassroom();
    }

    #[Group('FR-CM'), Group('FR-CM-01'), Group('FR-CM-02')]
    public function test_academic_administrator_can_create_class_with_program_and_instructor(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/classes', [
            'name' => 'Ethics', 'code' => 'ETH-201', 'program' => 'BSCRIM',
            'instructor_id' => $this->instructor->id, 'is_active' => true,
        ])->assertCreated()->assertJsonPath('class.instructor.id', $this->instructor->id);

        $this->assertDatabaseHas('courses', ['code' => 'ETH-201', 'program' => 'BSCRIM', 'instructor_id' => $this->instructor->id]);
    }

    #[Group('FR-CM'), Group('FR-CM-01')]
    public function test_duplicate_class_code_is_rejected(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/classes', ['name' => 'Copy', 'code' => 'CRIM-101'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    #[Group('FR-CM'), Group('FR-CM-01')]
    public function test_academic_administrator_can_edit_class_and_set_status(): void
    {
        $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}", [
            'name' => 'Criminal Law 1 (Revised)', 'code' => 'CRIM-101', 'is_active' => false,
        ])->assertOk();

        $this->assertDatabaseHas('courses', ['id' => $this->class->id, 'name' => 'Criminal Law 1 (Revised)', 'is_active' => false]);
    }

    #[Group('FR-CM'), Group('FR-CM-03')]
    public function test_academic_administrator_can_add_and_remove_learners(): void
    {
        $newcomer = User::factory()->create(['role' => 'learner', 'school_id' => '24-00050', 'is_active' => true, 'owner_admin_id' => $this->admin->id]);

        $this->actingAs($this->admin)->postJson("/api/admin/classes/{$this->class->id}/learners", ['learner_id' => $newcomer->id])
            ->assertSuccessful();
        $this->assertDatabaseHas('course_user', ['course_id' => $this->class->id, 'user_id' => $newcomer->id]);

        $this->actingAs($this->admin)->deleteJson("/api/admin/classes/{$this->class->id}/learners/{$newcomer->id}")
            ->assertSuccessful();
        $this->assertDatabaseMissing('course_user', ['course_id' => $this->class->id, 'user_id' => $newcomer->id]);
    }

    #[Group('FR-CM'), Group('FR-CM-04')]
    public function test_academic_administrator_can_assign_library_modules_to_class(): void
    {
        $this->libraryCourseFor($this->class, ['BSCRIM-LAW1-M2'], 'LAW1');
        $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2', 'is_published' => true]],
        ])->assertOk();

        $this->assertDatabaseHas('modules', ['course_id' => $this->class->id, 'library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2']);
    }

    #[Group('FR-CM'), Group('FR-CM-04')]
    public function test_class_modules_can_be_emptied(): void
    {
        $this->libraryCourseFor($this->class, ['BSCRIM-LAW1-M2'], 'LAW1');
        $sync = fn (array $modules) => $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => $modules,
        ]);

        $sync([['library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2', 'is_published' => true]])->assertOk();

        // A class does not need a module: an empty list removes them all.
        $sync([])->assertOk();

        $this->assertSoftDeleted('modules', ['course_id' => $this->class->id, 'library_key' => 'BSCRIM-LAW1-M2']);
    }

    #[Group('FR-CM'), Group('FR-CM-04')]
    public function test_module_from_another_course_cannot_be_assigned(): void
    {
        // This Class's Course is LAW1; BSIT-WEBDEV-M1 belongs to another Course.
        $this->libraryCourseFor($this->class, ['BSCRIM-LAW1-M2'], 'LAW1');
        $this->libraryCourseFor($this->otherClass, ['BSIT-WEBDEV-M1'], 'WEBDEV');

        $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'BSIT-WEBDEV-M1', 'title' => 'Web Development Module 1', 'is_published' => true]],
        ])->assertStatus(422)->assertJsonValidationErrors('modules.0.library_key');

        $this->assertDatabaseMissing('modules', ['course_id' => $this->class->id, 'library_key' => 'BSIT-WEBDEV-M1']);
    }

    #[Group('FR-CM'), Group('FR-CM-04')]
    public function test_module_not_in_the_library_cannot_be_assigned(): void
    {
        $this->libraryCourseFor($this->class, ['BSCRIM-LAW1-M2'], 'LAW1');

        $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'made-up-key', 'title' => 'Fake', 'is_published' => true]],
        ])->assertStatus(422);
    }

    #[Group('FR-CM'), Group('FR-CM-04')]
    public function test_class_without_a_course_cannot_receive_modules(): void
    {
        $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2', 'is_published' => true]],
        ])->assertStatus(422);
    }

    #[Group('FR-CM'), Group('FR-CM-04')]
    public function test_modules_already_assigned_stay_after_the_library_changes(): void
    {
        $this->libraryCourseFor($this->class, ['BSCRIM-LAW1-M2'], 'LAW1');
        $sync = fn () => $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2', 'is_published' => true]],
        ]);
        $sync()->assertOk();

        // The module is later removed from the library; re-saving still works.
        \App\Models\ModuleLibrary::current()->update(['data' => json_encode(['programs' => []])]);
        $sync()->assertOk();
    }

    #[Group('FR-CM'), Group('FR-CM-07')]
    public function test_instructor_sees_only_assigned_classes(): void
    {
        $classes = $this->actingAs($this->instructor)->getJson('/api/instructor/classes')->assertOk()->json();
        $text = json_encode($classes);

        $this->assertStringContainsString('CRIM-101', $text);
        $this->assertStringNotContainsString('CRIM-102', $text);

        $this->actingAs($this->instructor)->getJson("/api/instructor/classes/{$this->otherClass->id}")
            ->assertStatus(404);
    }

    #[Group('FR-CM'), Group('NFR-S'), Group('FR-CM-01'), Group('NFR-S-02')]
    public function test_instructor_and_learner_cannot_manage_classes(): void
    {
        foreach ([$this->instructor, $this->learner] as $user) {
            $this->actingAs($user)->postJson('/api/admin/classes', ['name' => 'X', 'code' => 'X-1'])->assertForbidden();
            $this->actingAs($user)->deleteJson("/api/admin/classes/{$this->class->id}")->assertForbidden();
        }
        $this->assertSame(2, Course::count());
    }
}
