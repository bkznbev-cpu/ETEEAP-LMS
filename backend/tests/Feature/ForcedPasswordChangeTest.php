<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ForcedPasswordChangeTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, bool $setupComplete, string $schoolId): User
    {
        return User::factory()->create([
            'role' => $role,
            'school_id' => $schoolId,
            'password' => Hash::make('temporary-pass'),
            'is_active' => true,
            'password_setup_complete' => $setupComplete,
        ]);
    }

    private function login(string $schoolId, string $password = 'temporary-pass'): string
    {
        return $this->postJson('/api/login', [
            'school_id' => $schoolId,
            'password' => $password,
            'agree_terms' => true,
        ])->assertOk()->json('token');
    }

    public function test_terms_must_be_accepted_on_first_login_only(): void
    {
        $this->user('learner', false, '24-00010');
        $this->user('learner', true, '24-00011');

        // First login without agreeing: refused, no token.
        $this->postJson('/api/login', ['school_id' => '24-00010', 'password' => 'temporary-pass'])
            ->assertStatus(422)
            ->assertJsonPath('terms_required', true)
            ->assertJsonMissingPath('token');

        // First login after agreeing: allowed.
        $this->postJson('/api/login', [
            'school_id' => '24-00010',
            'password' => 'temporary-pass',
            'agree_terms' => true,
        ])->assertOk();

        // Later logins don't ask again.
        $this->postJson('/api/login', ['school_id' => '24-00011', 'password' => 'temporary-pass'])
            ->assertOk();
    }

    public function test_new_learner_is_blocked_until_password_is_set(): void
    {
        $this->user('learner', false, '24-00001');
        $token = $this->login('24-00001');

        $this->withToken($token)
            ->getJson('/api/student/courses')
            ->assertForbidden()
            ->assertJsonPath('code', 'password_setup_required');

        $newToken = $this->withToken($token)
            ->postJson('/api/student/setup-password', [
                'password' => 'my-new-password',
                'password_confirmation' => 'my-new-password',
            ])
            ->assertOk()
            ->json('token');

        $this->app['auth']->forgetGuards();

        $this->withToken($newToken)
            ->getJson('/api/student/courses')
            ->assertOk();
    }

    public function test_new_instructor_and_admin_are_blocked_until_password_is_set(): void
    {
        $this->user('instructor', false, 'INS-0001');
        $this->user('academic_admin', false, 'ADM-0001');

        $this->withToken($this->login('INS-0001'))
            ->getJson('/api/instructor/dashboard')
            ->assertForbidden()
            ->assertJsonPath('code', 'password_setup_required');

        $this->app['auth']->forgetGuards();

        $this->withToken($this->login('ADM-0001'))
            ->getJson('/api/admin/dashboard')
            ->assertForbidden()
            ->assertJsonPath('code', 'password_setup_required');
    }

    public function test_account_on_temporary_password_can_still_log_out(): void
    {
        $this->user('learner', false, '24-00002');
        $token = $this->login('24-00002');

        $this->withToken($token)->postJson('/api/logout')->assertOk();
    }

    public function test_learner_created_by_admin_must_change_password(): void
    {
        $admin = $this->user('academic_admin', true, 'ADM-0002');

        $this->actingAs($admin)
            ->postJson('/api/admin/learners', [
                'name' => 'New Learner',
                'school_id' => '24-00003',
                'email' => 'new.learner@example.com',
                'password' => 'admin-chosen-pass',
            ])
            ->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'school_id' => '24-00003',
            'password_setup_complete' => false,
        ]);
    }

    public function test_instructor_created_by_admin_must_change_password(): void
    {
        $admin = $this->user('academic_admin', true, 'ADM-0003');

        $this->actingAs($admin)
            ->postJson('/api/admin/instructors', [
                'name' => 'New Instructor',
                'school_id' => 'INS-0002',
                'email' => 'new.instructor@example.com',
                'password' => 'admin-chosen-pass',
            ])
            ->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'school_id' => 'INS-0002',
            'password_setup_complete' => false,
        ]);
    }

    public function test_admin_password_reset_forces_a_change_and_logs_the_user_out(): void
    {
        $admin = $this->user('academic_admin', true, 'ADM-0004');
        $learner = $this->user('learner', true, '24-00004');
        $learner->update(['owner_admin_id' => $admin->id]);
        $learner->createToken('old-session');

        $this->actingAs($admin)
            ->putJson("/api/admin/learners/{$learner->id}", [
                'password' => 'reset-by-admin',
            ])
            ->assertOk();

        $learner->refresh();
        $this->assertFalse($learner->password_setup_complete);
        $this->assertSame(0, $learner->tokens()->count());
    }

    public function test_editing_a_learner_without_a_password_keeps_their_setup(): void
    {
        $admin = $this->user('academic_admin', true, 'ADM-0005');
        $learner = $this->user('learner', true, '24-00005');
        $learner->update(['owner_admin_id' => $admin->id]);
        $learner->createToken('session');

        $this->actingAs($admin)
            ->putJson("/api/admin/learners/{$learner->id}", [
                'name' => 'Renamed Learner',
            ])
            ->assertOk();

        $learner->refresh();
        $this->assertTrue($learner->password_setup_complete);
        $this->assertSame(1, $learner->tokens()->count());
    }

    public function test_learner_can_change_their_own_password(): void
    {
        $this->user('learner', true, '24-00006');
        $token = $this->login('24-00006');

        $this->withToken($token)
            ->putJson('/api/account/password', [
                'current_password' => 'wrong-password',
                'password' => 'learner-new-pass',
                'password_confirmation' => 'learner-new-pass',
            ])
            ->assertStatus(422);

        $this->withToken($token)
            ->putJson('/api/account/password', [
                'current_password' => 'temporary-pass',
                'password' => 'learner-new-pass',
                'password_confirmation' => 'learner-new-pass',
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->login('24-00006', 'learner-new-pass');
    }

    public function test_changing_password_logs_out_other_sessions_only(): void
    {
        $this->user('academic_admin', true, 'ADM-0006');
        $this->login('ADM-0006');               // another device
        $current = $this->login('ADM-0006');    // this device

        $this->withToken($current)
            ->putJson('/api/admin/change-password', [
                'current_password' => 'temporary-pass',
                'password' => 'brand-new-pass',
                'password_confirmation' => 'brand-new-pass',
            ])
            ->assertOk();

        $admin = User::where('school_id', 'ADM-0006')->first();
        $this->assertSame(1, $admin->tokens()->count());

        $this->app['auth']->forgetGuards();

        $this->withToken($current)
            ->getJson('/api/admin/profile')
            ->assertOk();
    }
}
