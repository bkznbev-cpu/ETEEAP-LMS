<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class SystemAdminAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    #[Group('FR-AU'), Group('FR-AU-01')]
    public function test_system_admin_can_log_in_and_verify_the_protected_session(): void
    {
        User::factory()->create([
            'school_id' => 'SYS-00001',
            'password' => Hash::make('system-admin-password'),
            'role' => 'system_admin',
            'is_active' => true,
            'password_setup_complete' => true,
        ]);

        $login = $this->postJson('/api/login', [
            'school_id' => 'SYS-00001',
            'password' => 'system-admin-password',
        ]);

        $login->assertOk()
            ->assertJsonPath('user.role', 'system_admin')
            ->assertJsonPath('first_login', false);

        $this->withToken($login->json('token'))
            ->getJson('/api/system-admin/session')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    public function test_system_admin_session_requires_authentication(): void
    {
        $this->postJson('/api/logout')
            ->assertUnauthorized();

        $this->getJson('/api/system-admin/session')
            ->assertUnauthorized();

        $this->getJson('/api/system-admin/dashboard')
            ->assertUnauthorized();
    }

    #[Group('FR-AU'), Group('FR-AU-05')]
    public function test_logout_revokes_the_current_token_and_protected_endpoints_reject_it(): void
    {
        $systemAdmin = User::factory()->create([
            'school_id' => 'SYS-LOGOUT-01',
            'role' => 'system_admin',
            'is_active' => true,
        ]);

        $issuedToken = $systemAdmin->createToken('logout-test');
        $tokenId = $issuedToken->accessToken->getKey();
        $plainTextToken = $issuedToken->plainTextToken;

        $this->withToken($plainTextToken)
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => $tokenId,
        ]);

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/system-admin/session')
            ->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/system-admin/dashboard')
            ->assertUnauthorized();
    }

    #[Group('FR-AU'), Group('FR-AU-05')]
    public function test_authenticated_non_system_admin_can_use_shared_logout(): void
    {
        $academicAdmin = User::factory()->create([
            'school_id' => 'AA-LOGOUT-01',
            'role' => 'academic_admin',
            'is_active' => true,
        ]);

        $issuedToken = $academicAdmin->createToken('academic-logout-test');
        $tokenId = $issuedToken->accessToken->getKey();

        $this->withToken($issuedToken->plainTextToken)
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => $tokenId,
        ]);
    }

    #[Group('FR-SA'), Group('FR-SA-06')]
    public function test_system_admin_dashboard_returns_real_account_statistics(): void
    {
        $systemAdmin = User::factory()->create([
            'school_id' => 'SYS-STAT-01',
            'role' => 'system_admin',
            'is_active' => true,
        ]);

        User::factory()->create([
            'school_id' => 'LEARNER-STAT-01',
            'role' => 'learner',
            'is_active' => true,
        ]);

        User::factory()->create([
            'school_id' => 'LEARNER-STAT-02',
            'role' => 'learner',
            'is_active' => false,
        ]);

        User::factory()->create([
            'school_id' => 'INSTRUCTOR-STAT-01',
            'role' => 'instructor',
            'is_active' => true,
        ]);

        User::factory()->create([
            'school_id' => 'ACADEMIC-STAT-01',
            'role' => 'academic_admin',
            'is_active' => false,
        ]);

        User::factory()->create([
            'school_id' => 'LEGACY-STAT-01',
            'role' => 'admin',
            'is_active' => true,
        ]);

        $token = $systemAdmin->createToken('dashboard-test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/system-admin/dashboard')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('statistics.total_users', 6)
            ->assertJsonPath('statistics.learners', 2)
            ->assertJsonPath('statistics.instructors', 1)
            ->assertJsonPath('statistics.academic_admins', 1)
            ->assertJsonPath('statistics.system_admins', 1)
            ->assertJsonPath('statistics.active_accounts', 4)
            ->assertJsonPath('statistics.inactive_accounts', 2);
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    public function test_non_system_admin_roles_cannot_verify_a_system_admin_session(): void
    {
        foreach (
            ['academic_admin', 'admin', 'administrator', 'instructor', 'learner']
            as $index => $role
        ) {
            $user = User::factory()->create([
                'school_id' => 'TEST-' . $index,
                'role' => $role,
                'is_active' => true,
            ]);

            $this->withToken($user->createToken('test-token')->plainTextToken)
                ->getJson('/api/system-admin/session')
                ->assertForbidden()
                ->assertJsonPath('success', false);

            $this->getJson('/api/system-admin/dashboard')
                ->assertForbidden()
                ->assertJsonPath('success', false);
        }
    }
}
