<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * Sign-in, sign-out, lockout and own-account events in audit_logs.
 */
#[Group('integration')]
class AuditLogEventsTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $schoolId, array $extra = []): User
    {
        return User::factory()->create(array_merge([
            'role' => $role,
            'school_id' => $schoolId,
            'name' => "{$role} {$schoolId}",
            'password' => Hash::make('right-password-1'),
            'is_active' => true,
        ], $extra));
    }

    private function login(string $schoolId, string $password = 'right-password-1')
    {
        return $this->postJson('/api/login', ['school_id' => $schoolId, 'password' => $password, 'agree_terms' => true]);
    }

    private function entries(string $action)
    {
        return AuditLogEntry::where('action', $action)->orderBy('id')->get();
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_successful_sign_in_and_sign_out_are_recorded_with_role_and_ip(): void
    {
        $learner = $this->user('learner', '24-A0001');

        $token = $this->login('24-A0001')->assertOk()->json('token');
        $this->withToken($token)->postJson('/api/logout')->assertOk();

        $signIn = $this->entries('sign_in')->sole();
        $this->assertSame($learner->id, $signIn->actor_id);
        $this->assertSame('learner', $signIn->actor_role);
        $this->assertSame('Authentication', $signIn->module);
        $this->assertSame('127.0.0.1', $signIn->ip_address);
        $this->assertSame('user', $signIn->target_type);
        $this->assertSame('24-A0001', $signIn->target_id);
        $this->assertSame('success', $signIn->result);

        $this->assertSame($learner->id, $this->entries('sign_out')->sole()->actor_id);
    }

    #[Group('FR-SA'), Group('NFR-S'), Group('FR-SA-03'), Group('NFR-S-05')]
    public function test_five_wrong_passwords_lock_the_account_and_are_logged_without_passwords(): void
    {
        $this->user('academic_admin', 'ADM-A1');

        for ($i = 0; $i < 4; $i++) {
            $this->login('ADM-A1', 'wrong-guess-' . $i)->assertStatus(401);
        }
        $this->login('ADM-A1', 'wrong-guess-4')->assertStatus(429)->assertJsonPath('locked', true);
        $this->login('NO-SUCH-ID', 'whatever-123')->assertStatus(401);

        $failed = $this->entries('sign_in_failed');
        $this->assertCount(6, $failed);
        $this->assertSame('Unknown', $failed[0]->actor_name);
        $this->assertNull($failed[0]->actor_id);
        $this->assertSame('failed', $failed[0]->result);
        $this->assertSame('Authentication', $failed[0]->module);
        $this->assertSame('ADM-A1', $failed[0]->target_id);
        $this->assertStringContainsString('attempt 1 of 5', $failed[0]->details);
        $this->assertSame('NO-SUCH-ID', $failed[5]->target_id);

        $locked = $this->entries('account_locked')->sole();
        $this->assertSame('Authentication', $locked->module);
        $this->assertSame('ADM-A1', $locked->target_id);
        $this->assertSame('127.0.0.1', $locked->ip_address);
        $this->assertSame(15, $locked->new_values['locked_minutes']);
        $this->assertStringContainsString('locked for 15 minutes after 5 failed sign-ins', $locked->details);

        // A try during the lock is logged too.
        $this->login('ADM-A1', 'right-password-1')->assertStatus(429);
        $this->assertStringContainsString('while the account is locked', $this->entries('sign_in_failed')->last()->details);

        // No password, typed or stored, ever lands in the log.
        $everything = AuditLogEntry::all()->toJson();
        $this->assertStringNotContainsString('wrong-guess', $everything);
        $this->assertStringNotContainsString('whatever-123', $everything);
        $this->assertStringNotContainsString('right-password-1', $everything);
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_deactivated_account_sign_in_is_recorded_as_refused(): void
    {
        $this->user('instructor', 'INS-A1', ['is_active' => false]);

        $this->login('INS-A1')->assertForbidden();

        $blocked = $this->entries('sign_in_blocked')->sole();
        $this->assertSame('failed', $blocked->result);
        $this->assertStringContainsString('deactivated', $blocked->details);
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_password_setup_and_change_are_recorded(): void
    {
        $this->user('learner', '24-A0002', ['password_setup_complete' => false]);
        $token = $this->login('24-A0002')->json('token');

        $newToken = $this->withToken($token)
            ->postJson('/api/student/setup-password', [
                'password' => 'learner-own-pass',
                'password_confirmation' => 'learner-own-pass',
            ])->assertOk()->json('token');

        $this->app['auth']->forgetGuards();

        $this->withToken($newToken)
            ->putJson('/api/account/password', [
                'current_password' => 'learner-own-pass',
                'password' => 'learner-newer-pass',
                'password_confirmation' => 'learner-newer-pass',
            ])->assertOk();

        $this->assertCount(1, $this->entries('password_set'));
        $this->assertCount(1, $this->entries('password_change'));
        $this->assertStringNotContainsString('learner-newer-pass', AuditLogEntry::all()->toJson());
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_system_admin_profile_changes_are_recorded_with_old_and_new(): void
    {
        $admin = $this->user('system_admin', 'SYS-A1', ['name' => 'Old Name', 'email' => 'old@x.edu']);

        $this->actingAs($admin)
            ->postJson('/api/system-admin/profile', ['name' => 'New Name', 'email' => 'old@x.edu'])
            ->assertOk();

        // Saving without changes adds nothing.
        $this->actingAs($admin)
            ->postJson('/api/system-admin/profile', ['name' => 'New Name', 'email' => 'old@x.edu'])
            ->assertOk();

        $entry = AuditLogEntry::where('module', 'Own Account')->where('action', 'update')->sole();
        $this->assertSame(['name' => 'Old Name'], $entry->old_values);
        $this->assertSame(['name' => 'New Name'], $entry->new_values);
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_entries_cannot_be_changed_or_deleted(): void
    {
        $this->user('learner', '24-A0009');
        $this->login('24-A0009')->assertOk();
        $entry = AuditLogEntry::firstOrFail();

        try {
            $entry->update(['details' => 'tampered']);
            $this->fail('An audit entry was changed.');
        } catch (\LogicException) {
        }

        try {
            $entry->delete();
            $this->fail('An audit entry was deleted.');
        } catch (\LogicException) {
        }

        $this->assertSame('Signed in', $entry->fresh()->details);
    }
}
