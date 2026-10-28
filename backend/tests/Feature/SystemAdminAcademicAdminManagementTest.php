<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SystemAdminAcademicAdminManagementTest extends TestCase
{
    use RefreshDatabase;

    private function systemAdmin(): User
    {
        return User::factory()->create([
            'role' => 'system_admin',
            'school_id' => 'SYS-MGMT-01',
            'is_active' => true,
        ]);
    }

    private function withSystemAdminToken(User $admin): static
    {
        return $this->withToken(
            $admin->createToken('system-admin-management-test')->plainTextToken
        );
    }

    public function test_management_routes_require_a_system_admin(): void
    {
        $this->getJson('/api/system-admin/academic-administrators')
            ->assertUnauthorized();

        $academicAdmin = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-MGMT-01',
        ]);

        $this->withToken($academicAdmin->createToken('not-system-admin')->plainTextToken)
            ->getJson('/api/system-admin/academic-administrators')
            ->assertForbidden();
    }

    public function test_system_admin_lists_only_academic_admin_accounts(): void
    {
        $systemAdmin = $this->systemAdmin();
        $first = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-LIST-01',
        ]);
        User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-LIST-02',
            'is_active' => false,
        ]);
        User::factory()->create([
            'role' => 'instructor',
            'school_id' => 'INS-LIST-01',
        ]);

        $this->withSystemAdminToken($systemAdmin)
            ->getJson('/api/system-admin/academic-administrators')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'administrators')
            ->assertJsonFragment([
                'id' => $first->id,
                'school_id' => 'AA-LIST-01',
                'role' => 'academic_admin',
            ]);
    }

    public function test_system_admin_can_create_an_academic_admin_and_audit_it(): void
    {
        $systemAdmin = $this->systemAdmin();

        $response = $this->withSystemAdminToken($systemAdmin)
            ->postJson('/api/system-admin/academic-administrators', [
                'name' => 'New Academic Admin',
                'school_id' => 'AA-CREATE-01',
                'email' => 'new-academic@example.test',
                'password' => 'initial-password',
                'password_confirmation' => 'initial-password',
            ]);

        $response->assertCreated()
            ->assertJsonPath('administrator.name', 'New Academic Admin')
            ->assertJsonPath('administrator.school_id', 'AA-CREATE-01')
            ->assertJsonPath('administrator.role', 'academic_admin')
            ->assertJsonPath('administrator.password_setup_complete', false);

        $targetId = $response->json('administrator.id');
        $this->assertDatabaseHas('users', [
            'id' => $targetId,
            'role' => 'academic_admin',
            'is_active' => true,
        ]);
        $this->assertTrue(Hash::check(
            'initial-password',
            User::findOrFail($targetId)->password
        ));
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $systemAdmin->id,
            'action' => 'create',
            'module' => 'Academic Admin Accounts',
            'target_type' => 'user',
            'target_label' => 'New Academic Admin',
        ]);
    }

    public function test_create_validates_unique_school_id_email_and_password_confirmation(): void
    {
        $systemAdmin = $this->systemAdmin();
        User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-DUPLICATE-01',
            'email' => 'existing-academic@example.test',
        ]);
        // The email already has the most accounts allowed (2).
        User::factory()->create([
            'role' => 'learner',
            'school_id' => 'AA-DUPLICATE-02',
            'email' => 'existing-academic@example.test',
        ]);

        $this->withSystemAdminToken($systemAdmin)
            ->postJson('/api/system-admin/academic-administrators', [
                'name' => 'Duplicate Admin',
                'school_id' => 'AA-DUPLICATE-01',
                'email' => 'existing-academic@example.test',
                'password' => 'initial-password',
                'password_confirmation' => 'different-password',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'school_id',
                'email',
                'password',
            ]);
    }

    public function test_system_admin_can_edit_and_deactivate_with_audit_and_token_revocation(): void
    {
        $systemAdmin = $this->systemAdmin();
        $target = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-UPDATE-01',
            'name' => 'Old Name',
            'email' => 'old@example.test',
        ]);
        User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-UPDATE-02',
        ]);
        $target->createToken('deactivated-account-token');

        $this->withSystemAdminToken($systemAdmin)
            ->putJson("/api/system-admin/academic-administrators/{$target->id}", [
                'name' => 'Updated Name',
                'school_id' => 'AA-UPDATED-01',
                'email' => 'updated@example.test',
                'is_active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('administrator.is_active', false)
            ->assertJsonPath('administrator.school_id', 'AA-UPDATED-01');

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'name' => 'Updated Name',
            'email' => 'updated@example.test',
            'school_id' => 'AA-UPDATED-01',
            'is_active' => false,
        ]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $target->id,
            'tokenable_type' => User::class,
        ]);

        $audit = AuditLogEntry::where('target_id', 'AA-UPDATED-01')
            ->where('action', 'deactivate')
            ->firstOrFail();
        $this->assertSame($systemAdmin->id, $audit->actor_id);
        $this->assertSame('AA-UPDATE-01', $audit->old_values['school_id']);
        $this->assertSame('AA-UPDATED-01', $audit->new_values['school_id']);
    }

    public function test_system_admin_can_reactivate_an_academic_admin(): void
    {
        $systemAdmin = $this->systemAdmin();
        $target = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-REACTIVATE-01',
            'is_active' => false,
        ]);

        $this->withSystemAdminToken($systemAdmin)
            ->putJson("/api/system-admin/academic-administrators/{$target->id}", [
                'is_active' => true,
            ])
            ->assertOk()
            ->assertJsonPath('administrator.is_active', true);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $systemAdmin->id,
            'action' => 'activate',
            'target_id' => $target->school_id,
        ]);
    }

    public function test_delete_removes_only_the_target_account_and_keeps_audit_record(): void
    {
        $systemAdmin = $this->systemAdmin();
        $target = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-DELETE-01',
            'name' => 'Deleted Admin',
        ]);
        User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-DELETE-02',
        ]);

        $this->withSystemAdminToken($systemAdmin)
            ->deleteJson("/api/system-admin/academic-administrators/{$target->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $systemAdmin->id,
            'action' => 'delete',
            'target_id' => $target->school_id,
            'target_label' => 'Deleted Admin',
        ]);
    }

    public function test_last_active_academic_admin_cannot_be_deactivated_or_deleted(): void
    {
        $systemAdmin = $this->systemAdmin();
        $target = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'AA-LAST-01',
            'is_active' => true,
        ]);
        $token = $systemAdmin->createToken('last-admin-protection')->plainTextToken;

        $this->withToken($token)
            ->putJson("/api/system-admin/academic-administrators/{$target->id}", [
                'is_active' => false,
            ])
            ->assertConflict();

        $this->withToken($token)
            ->deleteJson("/api/system-admin/academic-administrators/{$target->id}")
            ->assertConflict();

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'is_active' => true,
        ]);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_system_admin_endpoints_cannot_target_a_different_role(): void
    {
        $systemAdmin = $this->systemAdmin();
        $protectedUser = User::factory()->create([
            'role' => 'system_admin',
            'school_id' => 'SYS-PROTECTED-01',
        ]);

        $this->withSystemAdminToken($systemAdmin)
            ->deleteJson("/api/system-admin/academic-administrators/{$protectedUser->id}")
            ->assertNotFound();

        $this->assertDatabaseHas('users', [
            'id' => $protectedUser->id,
            'role' => 'system_admin',
        ]);
    }
}
