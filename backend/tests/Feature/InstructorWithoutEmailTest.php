<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InstructorWithoutEmailTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'ADM-NOEMAIL',
            'is_active' => true,
        ]);
    }

    public function test_an_instructor_can_be_added_without_an_email(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/instructors', [
                'name' => 'No Email Instructor',
                'school_id' => 'INS-701',
                'email' => null,
                'password' => 'temporary-1',
            ])
            ->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'school_id' => 'INS-701',
            'email' => null,
            'role' => 'instructor',
            'owner_admin_id' => $this->admin->id,
        ]);

        // Leaving it out entirely works too.
        $this->actingAs($this->admin)
            ->postJson('/api/admin/instructors', [
                'name' => 'Another',
                'school_id' => 'INS-702',
                'password' => 'temporary-1',
            ])
            ->assertSuccessful();
    }

    public function test_an_email_sent_by_the_admin_is_ignored(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/instructors', [
                'name' => 'Typed', 'school_id' => 'INS-703', 'email' => 'typed@x.edu', 'password' => 'temporary-1',
            ])
            ->assertSuccessful();

        $this->assertNull(User::where('school_id', 'INS-703')->value('email'));
    }

    public function test_editing_never_changes_the_email(): void
    {
        $instructor = User::factory()->create([
            'role' => 'instructor', 'school_id' => 'INS-705', 'email' => 'keep@x.edu',
            'owner_admin_id' => $this->admin->id, 'is_active' => true,
        ]);

        foreach ([null, 'other@x.edu'] as $sent) {
            $this->actingAs($this->admin)
                ->putJson("/api/admin/instructors/{$instructor->id}", ['name' => 'Renamed', 'email' => $sent])
                ->assertOk();
            $this->assertSame('keep@x.edu', $instructor->fresh()->email);
        }
    }

    public function test_a_new_account_can_be_deactivated_and_reset_before_first_login(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/instructors', [
                'name' => 'Brand New', 'school_id' => 'INS-706', 'password' => 'temporary-1',
            ])
            ->assertSuccessful();

        $instructor = User::where('school_id', 'INS-706')->firstOrFail();
        $this->assertFalse($instructor->password_setup_complete);

        $this->actingAs($this->admin)
            ->putJson("/api/admin/instructors/{$instructor->id}", ['is_active' => false])
            ->assertOk();
        $this->assertFalse($instructor->fresh()->is_active);

        $this->actingAs($this->admin)
            ->putJson("/api/admin/instructors/{$instructor->id}", ['password' => 'another-temp-2'])
            ->assertOk();
        $this->assertFalse($instructor->fresh()->password_setup_complete);
    }
}
