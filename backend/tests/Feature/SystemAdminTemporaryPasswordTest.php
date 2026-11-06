<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class SystemAdminTemporaryPasswordTest extends TestCase
{
    use RefreshDatabase;

    private function systemAdmin(): User
    {
        return User::factory()->create([
            'role' => 'system_admin',
            'school_id' => 'SYS-T1',
            'is_active' => true,
        ]);
    }

    #[Group('FR-UM'), Group('FR-UM-04')]
    public function test_creating_without_email_or_password_generates_a_temporary_password(): void
    {
        $systemAdmin = $this->systemAdmin();

        $response = $this->actingAs($systemAdmin)
            ->postJson('/api/system-admin/academic-administrators', [
                'name' => 'No Email Admin',
                'school_id' => 'ADM-T1',
            ])
            ->assertCreated()
            ->assertJsonPath('administrator.email', null)
            ->assertJsonPath('administrator.password_setup_complete', false);

        $temporary = $response->json('temporary_password');
        $this->assertIsString($temporary);
        $this->assertSame(12, strlen($temporary));
        $this->assertMatchesRegularExpression('/^[A-HJ-NP-Za-km-np-z2-9]+$/', $temporary);

        // The temporary password works, and the account must change it.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['school_id' => 'ADM-T1', 'password' => $temporary, 'agree_terms' => true])
            ->assertOk()
            ->assertJsonPath('first_login', true);
    }

    #[Group('FR-UM'), Group('FR-UM-04')]
    public function test_a_typed_password_is_still_accepted_and_not_echoed_back(): void
    {
        $systemAdmin = $this->systemAdmin();

        $this->actingAs($systemAdmin)
            ->postJson('/api/system-admin/academic-administrators', [
                'name' => 'Typed Admin',
                'school_id' => 'ADM-T2',
                'password' => 'typed-by-admin',
                'password_confirmation' => 'typed-by-admin',
            ])
            ->assertCreated()
            ->assertJsonMissingPath('temporary_password');

        $this->assertTrue(Hash::check('typed-by-admin', User::where('school_id', 'ADM-T2')->value('password')));
    }

    #[Group('FR-UM'), Group('FR-UM-04')]
    public function test_reset_gives_a_new_temporary_password_and_ends_sessions(): void
    {
        $systemAdmin = $this->systemAdmin();
        $admin = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'ADM-T3',
            'password' => Hash::make('old-own-password'),
            'password_setup_complete' => true,
            'is_active' => true,
        ]);
        $admin->createToken('old-session');

        $temporary = $this->actingAs($systemAdmin)
            ->postJson("/api/system-admin/academic-administrators/{$admin->id}/reset-password")
            ->assertOk()
            ->assertJsonPath('administrator.password_setup_complete', false)
            ->json('temporary_password');

        $admin->refresh();
        $this->assertTrue(Hash::check($temporary, $admin->password));
        $this->assertFalse(Hash::check('old-own-password', $admin->password));
        $this->assertFalse($admin->password_setup_complete);
        $this->assertSame(0, $admin->tokens()->count());

        // Recorded in the audit log, without the password.
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'reset_password',
            'module' => 'Academic Admin Accounts',
            'target_id' => $admin->school_id,
        ]);
        $this->assertStringNotContainsString(
            $temporary,
            (string) json_encode(\DB::table('audit_logs')->get())
        );
    }

    #[Group('FR-UM'), Group('NFR-S'), Group('FR-UM-04'), Group('NFR-S-02')]
    public function test_reset_only_works_on_academic_admins_and_only_for_system_admins(): void
    {
        $systemAdmin = $this->systemAdmin();
        $learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-T0001']);
        $academicAdmin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-T4', 'is_active' => true]);

        $this->actingAs($systemAdmin)
            ->postJson("/api/system-admin/academic-administrators/{$learner->id}/reset-password")
            ->assertNotFound();

        $this->actingAs($academicAdmin)
            ->postJson("/api/system-admin/academic-administrators/{$academicAdmin->id}/reset-password")
            ->assertForbidden();
    }
}
