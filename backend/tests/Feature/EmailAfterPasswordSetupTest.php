<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\User;
use App\Notifications\EmailChangeCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * New accounts: set a new password, then add an email. Until the email
 * is added, the account can only add it or log out, and every sign-in
 * says the email is still needed.
 */
class EmailAfterPasswordSetupTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    /** The last code emailed to this address. */
    private function codeSentTo(string $email): string
    {
        $code = null;
        Notification::assertSentTo(
            new AnonymousNotifiable(),
            EmailChangeCode::class,
            function (EmailChangeCode $notification, array $channels, AnonymousNotifiable $notifiable) use ($email, &$code) {
                if (($notifiable->routes['mail'] ?? null) === $email) {
                    $code = $notification->code();
                }

                return true;
            }
        );

        $this->assertNotNull($code, "No code was sent to {$email}.");

        return $code;
    }

    private function newAccount(string $role, string $schoolId): User
    {
        return User::factory()->create([
            'role' => $role,
            'school_id' => $schoolId,
            'email' => null,
            'password' => Hash::make('Temp-pass-1'),
            'password_setup_complete' => false,
            'is_active' => true,
        ]);
    }

    public function test_learner_sets_password_then_must_add_email(): void
    {
        $learner = $this->newAccount('learner', '24-EM001');

        $login = $this->postJson('/api/login', ['school_id' => '24-EM001', 'password' => 'Temp-pass-1'])->assertOk();
        $login->assertJsonPath('first_login', true)->assertJsonPath('email_required', false);

        $token = $this->withToken($login->json('token'))
            ->postJson('/api/student/setup-password', ['password' => 'New-pass-12', 'password_confirmation' => 'New-pass-12'])
            ->assertOk()->json('token');

        // No email yet: everything else is refused.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/student/courses')
            ->assertForbidden()->assertJsonPath('code', 'email_required');

        // Signing in again still asks for the email.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['school_id' => '24-EM001', 'password' => 'New-pass-12'])
            ->assertOk()->assertJsonPath('first_login', false)->assertJsonPath('email_required', true);

        // Add it: a code is sent, and the email is not saved yet.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/account/email', ['email' => 'Ana.Cruz@Example.com'])
            ->assertOk()->assertJsonPath('verification_required', true);
        $this->assertNull($learner->fresh()->email);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/student/courses')
            ->assertForbidden()->assertJsonPath('code', 'email_required');

        // A wrong code is refused.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/account/email/verify', ['code' => '000000'])->assertStatus(422);

        // The right code saves and confirms it.
        $code = $this->codeSentTo('ana.cruz@example.com');
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/account/email/verify', ['code' => $code])
            ->assertOk()->assertJsonPath('user.email', 'ana.cruz@example.com');
        $this->assertNotNull($learner->fresh()->email_verified_at);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/student/courses')->assertOk();
        $this->postJson('/api/login', ['school_id' => '24-EM001', 'password' => 'New-pass-12'])
            ->assertJsonPath('email_required', false);

        $entry = AuditLogEntry::where('action', 'email_added')->sole();
        $this->assertSame($learner->id, $entry->actor_id);
        $this->assertSame('ana.cruz@example.com', $entry->new_values['email']);
    }

    public function test_instructor_and_academic_admin_must_add_email_too(): void
    {
        foreach (['instructor' => '/api/instructor/dashboard', 'academic_admin' => '/api/admin/profile'] as $role => $page) {
            $user = $this->newAccount($role, strtoupper($role) . '-EM');
            $user->update(['password_setup_complete' => true]);

            $this->actingAs($user)->getJson($page)->assertForbidden()->assertJsonPath('code', 'email_required');
            $this->actingAs($user)->postJson('/api/account/email', ['email' => "{$role}@example.com"])->assertOk();
            $this->actingAs($user)->postJson('/api/account/email/verify', ['code' => $this->codeSentTo("{$role}@example.com")])->assertOk();
            $this->actingAs($user->fresh())->getJson($page)->assertOk();
        }
    }

    public function test_email_must_be_valid_and_not_used_by_another_account(): void
    {
        // Already used by the most accounts allowed (2).
        User::factory()->create(['role' => 'learner', 'school_id' => '24-EM009', 'email' => 'taken@example.com']);
        User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-EM009', 'email' => 'taken@example.com']);
        $learner = $this->newAccount('learner', '24-EM002');
        $learner->update(['password_setup_complete' => true]);

        $this->actingAs($learner)->postJson('/api/account/email', ['email' => ''])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'Please enter your email address.');
        $this->actingAs($learner)->postJson('/api/account/email', ['email' => 'not-an-email'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', 'Please enter a valid email address.');
        $this->actingAs($learner)->postJson('/api/account/email', ['email' => 'taken@example.com'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', \App\Rules\UniqueEmail::MESSAGE);
        $this->assertNull($learner->fresh()->email);
    }

    public function test_logout_still_works_without_an_email(): void
    {
        $learner = $this->newAccount('learner', '24-EM003');
        $learner->update(['password_setup_complete' => true]);
        $token = $learner->createToken('t')->plainTextToken;

        $this->withToken($token)->postJson('/api/logout')->assertOk();
    }

    public function test_email_typed_by_an_admin_must_be_confirmed_by_the_owner(): void
    {
        $learner = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-EM005', 'email' => 'verified@example.com',
            'password_setup_complete' => true, 'is_active' => true,
        ]);
        $this->actingAs($learner)->getJson('/api/student/courses')->assertOk();

        // The admin changes it: it is no longer confirmed.
        $learner->update(['email' => 'typed.by.admin@example.com']);
        $this->assertNull($learner->fresh()->email_verified_at);

        $this->actingAs($learner->fresh())->getJson('/api/student/courses')
            ->assertForbidden()->assertJsonPath('code', 'email_required');

        // The learner confirms it with the code.
        $this->actingAs($learner)->postJson('/api/account/email', ['email' => 'typed.by.admin@example.com'])->assertOk();
        $this->actingAs($learner)->postJson('/api/account/email/verify', ['code' => $this->codeSentTo('typed.by.admin@example.com')])->assertOk();
        $this->actingAs($learner->fresh())->getJson('/api/student/courses')->assertOk();
    }

    public function test_resend_waits_a_minute(): void
    {
        $learner = $this->newAccount('learner', '24-EM006');
        $learner->update(['password_setup_complete' => true]);

        $this->actingAs($learner)->postJson('/api/account/email', ['email' => 'wait@example.com'])->assertOk();
        $this->actingAs($learner)->postJson('/api/account/email/resend')->assertStatus(429);

        $this->travel(61)->seconds();
        $this->actingAs($learner)->postJson('/api/account/email/resend')->assertOk();
    }

    public function test_accounts_with_an_email_are_not_affected(): void
    {
        $learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-EM004', 'email' => 'ok@example.com', 'password_setup_complete' => true, 'is_active' => true]);

        $this->actingAs($learner)->getJson('/api/student/courses')->assertOk();
    }
}
