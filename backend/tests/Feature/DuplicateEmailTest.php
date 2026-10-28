<?php

namespace Tests\Feature;

use App\Models\User;
use App\Rules\UniqueEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * An email address can belong to only one account. Capital letters and
 * spaces don't make it a different address.
 */
class DuplicateEmailTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        // taken@example.com already has the most accounts allowed (2).
        User::factory()->create(['role' => 'learner', 'school_id' => '24-DUP01', 'email' => 'taken@example.com']);
        User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-DUP01', 'email' => 'taken@example.com']);
        $this->admin = User::factory()->create([
            'role' => 'academic_admin', 'school_id' => 'ADM-DUP', 'email' => 'admin@example.com', 'is_active' => true,
        ]);
    }

    public function test_setup_email_step_refuses_an_existing_email_in_any_case(): void
    {
        foreach (['learner', 'instructor', 'academic_admin'] as $i => $role) {
            $user = User::factory()->create([
                'role' => $role, 'school_id' => "NEW-{$i}", 'email' => null,
                'password_setup_complete' => true, 'is_active' => true,
            ]);

            foreach (['taken@example.com', 'TAKEN@Example.com', ' Taken@example.com '] as $email) {
                $this->actingAs($user)->postJson('/api/account/email', ['email' => $email])
                    ->assertStatus(422)->assertJsonPath('errors.email.0', UniqueEmail::MESSAGE);
            }

            $this->assertNull($user->fresh()->email);
        }
    }

    public function test_academic_admin_cannot_set_learner_or_instructor_emails(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/learners', [
            'name' => 'Copy', 'school_id' => '24-10009', 'email' => 'Taken@Example.com', 'password' => 'temporary-1',
        ])->assertSuccessful();
        $this->assertNull(User::where('school_id', '24-10009')->value('email'));

        $this->actingAs($this->admin)->postJson('/api/admin/instructors', [
            'name' => 'Copy', 'school_id' => 'INS-DUP', 'email' => 'TAKEN@example.com', 'password' => 'temporary-1',
        ])->assertSuccessful();
        $this->assertNull(User::where('school_id', 'INS-DUP')->value('email'));

        $learner = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-10010', 'email' => 'mine@example.com',
            'owner_admin_id' => $this->admin->id,
        ]);

        $this->actingAs($this->admin)->putJson("/api/admin/learners/{$learner->id}", ['email' => 'other@example.com'])
            ->assertSuccessful();
        $this->assertSame('mine@example.com', $learner->fresh()->email);
    }

    public function test_an_email_can_be_shared_by_two_accounts_but_not_three(): void
    {
        $systemAdmin = User::factory()->create(['role' => 'system_admin', 'school_id' => 'SYS-DUP', 'is_active' => true]);

        // admin@example.com has 1 account: a 2nd is allowed...
        $this->actingAs($systemAdmin)->postJson('/api/system-admin/academic-administrators', [
            'name' => 'Second', 'school_id' => 'ADM-COPY', 'email' => 'Admin@Example.com',
        ])->assertSuccessful();

        // ...a 3rd is not.
        $this->actingAs($systemAdmin)->postJson('/api/system-admin/academic-administrators', [
            'name' => 'Third', 'school_id' => 'ADM-COPY-2', 'email' => 'admin@example.com',
        ])->assertStatus(422)->assertJsonPath('errors.email.0', UniqueEmail::MESSAGE);
    }
}
