<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class NewLearnerAccountActionsTest extends TestCase
{
    use RefreshDatabase;

    #[Group('FR-UM'), Group('FR-UM-01')]
    public function test_a_new_learner_can_be_deactivated_and_reset_before_first_login(): void
    {
        $admin = User::factory()->create([
            'role' => 'academic_admin', 'school_id' => 'ADM-NEWL', 'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/learners', [
                'name' => 'Brand New Learner', 'school_id' => '24-81001', 'password' => 'temporary-1',
            ])
            ->assertSuccessful();

        $learner = User::where('school_id', '24-81001')->firstOrFail();
        $this->assertFalse($learner->password_setup_complete);

        $this->actingAs($admin)
            ->putJson("/api/admin/learners/{$learner->id}", ['is_active' => false])
            ->assertOk();
        $this->assertFalse($learner->fresh()->is_active);

        $this->actingAs($admin)
            ->putJson("/api/admin/learners/{$learner->id}", ['is_active' => true, 'password' => 'another-temp-2'])
            ->assertOk();
        $learner->refresh();
        $this->assertTrue($learner->is_active);
        $this->assertFalse($learner->password_setup_complete);
    }
}
