<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class LoginSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function account(string $schoolId = 'LS-00001'): User
    {
        return User::factory()->create([
            'school_id' => $schoolId,
            'password' => Hash::make('correct-password'),
            'role' => 'system_admin',
            'is_active' => true,
            'password_setup_complete' => true,
        ]);
    }

    private function attempt(string $schoolId, string $password)
    {
        return $this->postJson('/api/login', [
            'school_id' => $schoolId,
            'password' => $password,
        ]);
    }

    #[Group('NFR-S'), Group('NFR-S-05')]
    public function test_account_is_locked_after_five_failed_attempts(): void
    {
        $this->account();

        for ($i = 0; $i < 4; $i++) {
            $this->attempt('LS-00001', 'wrong-password')->assertStatus(401);
        }

        // The 5th wrong password locks the account and says so.
        $this->attempt('LS-00001', 'wrong-password')
            ->assertStatus(429)
            ->assertJsonPath('locked', true)
            ->assertJsonPath('message', 'This account is now temporarily locked after 5 failed sign-in attempts. Please try again in 15 minutes, or use "Forgot Password?".');

        // Even the correct password is refused during the lockout.
        $this->attempt('LS-00001', 'correct-password')
            ->assertStatus(429)
            ->assertJsonPath('success', false)
            ->assertJsonPath('locked', true);
    }

    #[Group('NFR-S'), Group('NFR-S-05')]
    public function test_lockout_lasts_fifteen_minutes(): void
    {
        $this->account();

        for ($i = 0; $i < 5; $i++) {
            $this->attempt('LS-00001', 'wrong-password');
        }

        $this->travel(14)->minutes();
        $this->attempt('LS-00001', 'correct-password')->assertStatus(429);

        $this->travel(61)->seconds();
        $this->attempt('LS-00001', 'correct-password')->assertOk();
    }

    #[Group('NFR-S'), Group('NFR-S-05')]
    public function test_lock_applies_to_the_account_from_any_computer(): void
    {
        $this->account();

        foreach (['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4', '10.0.0.5'] as $ip) {
            $this->withServerVariables(['REMOTE_ADDR' => $ip])->attempt('LS-00001', 'wrong-password');
        }

        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.9'])
            ->attempt('LS-00001', 'correct-password')
            ->assertStatus(429);
    }

    #[Group('NFR-S'), Group('NFR-S-05')]
    public function test_failures_older_than_fifteen_minutes_do_not_count(): void
    {
        $this->account();

        for ($i = 0; $i < 4; $i++) {
            $this->attempt('LS-00001', 'wrong-password')->assertStatus(401);
        }

        $this->travel(16)->minutes();

        $this->attempt('LS-00001', 'wrong-password')->assertStatus(401);
        $this->attempt('LS-00001', 'correct-password')->assertOk();
    }

    #[Group('NFR-S'), Group('NFR-S-05')]
    public function test_successful_login_resets_the_failure_count(): void
    {
        $this->account();

        for ($i = 0; $i < 4; $i++) {
            $this->attempt('LS-00001', 'wrong-password')->assertStatus(401);
        }

        $this->attempt('LS-00001', 'correct-password')->assertOk();

        for ($i = 0; $i < 4; $i++) {
            $this->attempt('LS-00001', 'wrong-password')->assertStatus(401);
        }

        $this->attempt('LS-00001', 'correct-password')->assertOk();
    }

    #[Group('NFR-S'), Group('NFR-S-05')]
    public function test_unknown_school_ids_are_also_limited(): void
    {
        for ($i = 0; $i < 4; $i++) {
            $this->attempt('NO-SUCH-ID', 'whatever')->assertStatus(401);
        }

        $this->attempt('NO-SUCH-ID', 'whatever')->assertStatus(429);
        $this->attempt('NO-SUCH-ID', 'whatever')->assertStatus(429);
    }

    #[Group('NFR-S'), Group('NFR-S-05')]
    public function test_one_address_cannot_try_many_accounts(): void
    {
        for ($i = 0; $i < 20; $i++) {
            $this->attempt("SPRAY-{$i}", 'password123')->assertStatus(401);
        }

        $this->account('LS-00002');

        $this->attempt('LS-00002', 'correct-password')->assertStatus(429);
    }

    #[Group('NFR-S'), Group('NFR-S-04')]
    public function test_login_token_expires_after_eight_hours(): void
    {
        $this->account();

        $token = $this->attempt('LS-00001', 'correct-password')->json('token');

        $this->withToken($token)
            ->getJson('/api/system-admin/session')
            ->assertOk();

        $this->travel(481)->minutes();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
            ->getJson('/api/system-admin/session')
            ->assertUnauthorized();
    }

    #[Group('NFR-S'), Group('NFR-S-04')]
    public function test_token_last_used_time_is_saved_at_most_once_a_minute(): void
    {
        $this->account();
        $token = $this->attempt('LS-00001', 'correct-password')->json('token');
        $tokenId = (int) explode('|', $token)[0];
        $lastUsed = fn () => \Illuminate\Support\Facades\DB::table('personal_access_tokens')->where('id', $tokenId)->value('last_used_at');

        $this->withToken($token)->getJson('/api/system-admin/session')->assertOk();
        $first = $lastUsed();
        $this->assertNotNull($first);

        // Within a minute: no new write.
        $this->travel(30)->seconds();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/system-admin/session')->assertOk();
        $this->assertSame($first, $lastUsed());

        // After a minute: saved again.
        $this->travel(40)->seconds();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/system-admin/session')->assertOk();
        $this->assertNotSame($first, $lastUsed());
    }

    #[Group('NFR-S'), Group('NFR-S-01')]
    public function test_older_slower_password_hash_is_resaved_on_sign_in(): void
    {
        $user = $this->account();

        // A password saved at a different (older) strength.
        $old = password_hash('correct-password', PASSWORD_BCRYPT, ['cost' => 11]);
        \Illuminate\Support\Facades\DB::table('users')->where('id', $user->id)->update(['password' => $old]);
        $this->assertTrue(Hash::needsRehash($user->fresh()->password));

        $this->attempt('LS-00001', 'correct-password')->assertOk();

        $saved = $user->fresh()->password;
        $this->assertNotSame($old, $saved);
        $this->assertFalse(Hash::needsRehash($saved));

        // The same password still works.
        $this->attempt('LS-00001', 'correct-password')->assertOk();
    }
}
