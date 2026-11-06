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
        $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2', 'is_published' => true]],
        ])->assertOk();

        $this->assertDatabaseHas('modules', ['course_id' => $this->class->id, 'library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2']);
    }

    #[Group('FR-CM'), Group('FR-CM-04'), Group('discrepancy')]
    public function test_module_from_another_course_cannot_be_assigned(): void
    {
        // The server stores no Course for a Class and no Course for a library
        // module, so it has nothing to compare. Any library module is accepted.
        $response = $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [['library_key' => 'BSIT-WEBDEV-M1', 'title' => 'Web Development Module 1', 'is_published' => true]],
        ]);

        if ($response->status() === 200) {
            $this->requirementNotMet('FR-CM-04', 'the server accepts any Module for any Class. Classes store only a Program name, and Courses exist only in the browser, so the "Modules from the Class\'s Course" rule is enforced only by the web page.');
        }
        $response->assertStatus(422);
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
