<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * The instructor list tells the Accounts page which classes each
 * instructor teaches, for the Assigned Classes column.
 */
#[Group('integration')]
class InstructorAssignedClassesTest extends TestCase
{
    use RefreshDatabase;

    #[Group('FR-UM')]
    public function test_instructor_list_includes_each_instructors_assigned_classes(): void
    {
        $admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-AC', 'is_active' => true]);
        $busy = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-501', 'is_active' => true]);
        $free = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-502', 'is_active' => true]);

        foreach (['C-101' => 'Math', 'C-102' => 'Science'] as $code => $name) {
            Course::create([
                'name' => $name, 'code' => $code, 'is_active' => true,
                'instructor_id' => $busy->id, 'owner_admin_id' => $admin->id,
            ]);
        }

        $instructors = collect(
            $this->actingAs($admin)->getJson('/api/admin/instructors')->assertOk()->json('instructors')
        )->keyBy('school_id');

        $this->assertCount(2, $instructors['INS-501']['assigned_classes']);
        $this->assertEqualsCanonicalizing(
            ['C-101', 'C-102'],
            array_column($instructors['INS-501']['assigned_classes'], 'code')
        );
        $this->assertSame([], $instructors['INS-502']['assigned_classes']);
        // The raw relation is not sent as well.
        $this->assertArrayNotHasKey('instructed_courses', $instructors['INS-501']);
    }
}
