<?php

namespace Tests\Feature;

use App\Models\EmailChangeRequest;
use App\Models\User;
use App\Notifications\EmailChangeAlert;
use App\Notifications\EmailChangeCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Changing your own email: current password, a 6-digit code sent to the
 * new address, and the email changes only after the code is entered.
 */
class EmailChangeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    private function account(string $role = 'learner', string $email = 'old@example.com'): User
    {
        static $n = 0;
        $n++;

        return User::factory()->create([
            'role' => $role,
            'school_id' => "EC-{$n}",
            'email' => $email === '' ? null : str_replace('@', "{$n}@", $email),
            'is_active' => true,
            'password_setup_complete' => true,
        ]);
    }

    private function request(User $user, string $newEmail, string $password = 'password')
    {
        return $this->actingAs($user)->postJson('/api/account/email-change', [
            'new_email' => $newEmail,
            'current_password' => $password,
        ]);
    }

    /** The code that was emailed to $address (taken from the faked mail). */
    private function sentCode(string $address): string
    {
        $code = null;

        Notification::assertSentTo(
            new AnonymousNotifiable,
            EmailChangeCode::class,
            function (EmailChangeCode $notification, array $channels, AnonymousNotifiable $notifiable) use ($address, &$code) {
                if (($notifiable->routes['mail'] ?? null) === $address) {
                    $code = $notification->code();
                    return true;
                }
                return false;
            }
        );

        return $code;
    }

    private function wrongCode(string $code): string
    {
        return $code === '000000' ? '111111' : '000000';
    }

    public function test_every_role_can_change_their_email_after_verifying_it(): void
    {
        foreach (['learner', 'instructor', 'academic_admin', 'system_admin'] as $role) {
            $user = $this->account($role);
            $old = $user->email;
            $new = "new.{$role}@example.com";

            $this->request($user, $new)
                ->assertOk()
                ->assertJsonPath('email', $old)
                ->assertJsonPath('pending.new_email', $new)
                ->assertJsonMissingPath('code')
                ->assertJsonMissingPath('pending.code_hash');

            // Not changed yet: the current email stays active.
            $this->assertSame($old, $user->fresh()->email);

            $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $this->sentCode($new)])
                ->assertOk()
                ->assertJsonPath('email', $new)
                ->assertJsonPath('email_verified', true)
                ->assertJsonPath('pending', null);

            $fresh = $user->fresh();
            $this->assertSame($new, $fresh->email);
            $this->assertNotNull($fresh->email_verified_at);
            $this->assertSame(0, EmailChangeRequest::where('user_id', $user->id)->count());
        }
    }

    public function test_the_old_address_is_told_about_the_request_and_the_change(): void
    {
        $user = $this->account();
        $old = $user->email;

        $this->request($user, 'fresh@example.com')->assertOk();
        $code = $this->sentCode('fresh@example.com');
        $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $code])->assertOk();

        foreach ([EmailChangeAlert::REQUESTED, EmailChangeAlert::COMPLETED] as $stage) {
            Notification::assertSentTo(
                new AnonymousNotifiable,
                EmailChangeAlert::class,
                fn ($notification, $channels, $notifiable) => ($notifiable->routes['mail'] ?? null) === $old
                    && $notification->stage() === $stage
            );
        }
    }

    public function test_invalid_email_formats_are_refused(): void
    {
        $user = $this->account();

        foreach (['', 'not-an-email', 'name@', '@example.com', str_repeat('a', 250) . '@example.com'] as $bad) {
            $this->request($user, $bad)->assertStatus(422)->assertJsonValidationErrors('new_email');
        }

        $this->assertSame(0, EmailChangeRequest::count());
        Notification::assertNothingSent();
    }

    public function test_an_address_used_by_another_account_is_refused(): void
    {
        $user = $this->account();
        // Already used by the most accounts allowed (2).
        $other = $this->account('instructor', 'taken@example.com');
        User::factory()->create(['role' => 'learner', 'school_id' => 'EC-TAKEN-2', 'email' => $other->email]);

        $this->request($user, strtoupper($other->email))
            ->assertStatus(422)
            ->assertJsonPath('message', \App\Rules\UniqueEmail::MESSAGE);

        // Your own current address is not a change either.
        $this->request($user, $user->email)->assertStatus(422)->assertJsonValidationErrors('new_email');

        Notification::assertNothingSent();
    }

    public function test_a_wrong_current_password_is_refused_and_limited(): void
    {
        $user = $this->account();

        for ($i = 0; $i < 5; $i++) {
            $this->request($user, 'new@example.com', 'wrong-password')
                ->assertStatus(422)
                ->assertJsonValidationErrors('current_password');
        }

        // Even the right password waits after five wrong ones.
        $this->request($user, 'new@example.com')->assertStatus(429);

        $this->assertSame(0, EmailChangeRequest::count());
        Notification::assertNothingSent();
    }

    public function test_wrong_codes_are_counted_and_cancel_the_request(): void
    {
        $user = $this->account();
        $old = $user->email;

        $this->request($user, 'new@example.com')->assertOk();
        $wrong = $this->wrongCode($this->sentCode('new@example.com'));

        $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => 'abc'])
            ->assertStatus(422)->assertJsonValidationErrors('code');

        for ($i = 4; $i >= 1; $i--) {
            $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $wrong])
                ->assertStatus(422)
                ->assertJsonPath('message', "The verification code is incorrect. {$i} " . ($i === 1 ? 'try' : 'tries') . ' left.');
        }

        $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $wrong])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Too many wrong codes. The request was cancelled; please start again.');

        $this->assertSame(0, EmailChangeRequest::count());
        $this->assertSame($old, $user->fresh()->email);
    }

    public function test_expired_codes_do_not_work(): void
    {
        $user = $this->account();
        $old = $user->email;

        $this->request($user, 'new@example.com')->assertOk();
        $code = $this->sentCode('new@example.com');

        $this->travel(16)->minutes();

        $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('message', 'The verification code has expired. Please request a new code.');

        $this->assertSame($old, $user->fresh()->email);
        $this->assertSame(0, EmailChangeRequest::count());
    }

    public function test_a_code_works_only_once(): void
    {
        $user = $this->account();

        $this->request($user, 'first@example.com')->assertOk();
        $code = $this->sentCode('first@example.com');
        $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $code])->assertOk();

        $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $code])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_resend_waits_a_minute_and_replaces_the_old_code(): void
    {
        $user = $this->account();

        $this->request($user, 'new@example.com')->assertOk();
        $first = $this->sentCode('new@example.com');

        $this->actingAs($user)->postJson('/api/account/email-change/resend')->assertStatus(429);

        $this->travel(61)->seconds();
        $this->actingAs($user)->postJson('/api/account/email-change/resend')->assertOk();

        Notification::assertSentTimes(EmailChangeCode::class, 2);

        // The newest code is the one stored; the first one stops working (unless both are equal by chance).
        $stored = EmailChangeRequest::where('user_id', $user->id)->firstOrFail();
        if (!\Illuminate\Support\Facades\Hash::check($first, $stored->code_hash)) {
            $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $first])
                ->assertStatus(422);
        }
    }

    public function test_a_pending_change_can_be_cancelled(): void
    {
        $user = $this->account();
        $old = $user->email;

        $this->request($user, 'new@example.com')->assertOk();
        $code = $this->sentCode('new@example.com');

        $this->actingAs($user)->getJson('/api/account/email-change')
            ->assertOk()->assertJsonPath('pending.new_email', 'new@example.com');

        $this->actingAs($user)->deleteJson('/api/account/email-change')
            ->assertOk()->assertJsonPath('pending', null);

        $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $code])->assertStatus(422);
        $this->assertSame($old, $user->fresh()->email);
    }

    public function test_an_address_taken_before_verification_is_not_given_away(): void
    {
        $user = $this->account();
        $this->request($user, 'race@example.com')->assertOk();
        $code = $this->sentCode('race@example.com');

        // Two other accounts get the address first.
        $this->account('learner', 'x@example.com')->forceFill(['email' => 'race@example.com'])->save();
        $this->account('instructor', 'y@example.com')->forceFill(['email' => 'race@example.com'])->save();

        $this->actingAs($user)->postJson('/api/account/email-change/verify', ['code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('message', \App\Rules\UniqueEmail::MESSAGE . ' Please choose a different one.');
        $this->assertNotSame('race@example.com', $user->fresh()->email);
    }

    public function test_people_can_only_change_their_own_email(): void
    {
        $owner = $this->account();
        $other = $this->account('instructor');

        // Not signed in.
        $this->postJson('/api/account/email-change', ['new_email' => 'a@example.com', 'current_password' => 'password'])
            ->assertUnauthorized();
        $this->postJson('/api/account/email-change/verify', ['code' => '123456'])->assertUnauthorized();

        // The owner's pending request cannot be finished or cancelled by someone else.
        $this->request($owner, 'mine@example.com')->assertOk();
        $code = $this->sentCode('mine@example.com');

        $this->actingAs($other)->postJson('/api/account/email-change/verify', ['code' => $code])->assertStatus(422);
        $this->actingAs($other)->deleteJson('/api/account/email-change')->assertOk();
        $this->assertSame(1, EmailChangeRequest::where('user_id', $owner->id)->count());

        // Profile forms cannot change the email directly any more.
        $this->actingAs($owner)->putJson('/api/student/profile', ['email' => 'direct@example.com'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->actingAs($other)->putJson('/api/instructor/profile', ['email' => 'direct@example.com'])
            ->assertStatus(422)->assertJsonValidationErrors('email');

        $this->assertNotSame('mine@example.com', $other->fresh()->email);
        $this->assertNotSame('direct@example.com', $owner->fresh()->email);
    }

    public function test_a_mail_failure_does_not_leave_a_pending_change(): void
    {
        $user = $this->account();

        // Mail sending fails (e.g. the SMTP server is down).
        $failing = new class implements \Illuminate\Contracts\Notifications\Dispatcher {
            public function send($notifiables, $notification)
            {
                throw new \RuntimeException('SMTP is down');
            }

            public function sendNow($notifiables, $notification, ?array $channels = null)
            {
                throw new \RuntimeException('SMTP is down');
            }
        };
        $this->app->instance(\Illuminate\Contracts\Notifications\Dispatcher::class, $failing);

        $this->request($user, 'new@example.com')
            ->assertStatus(503)
            ->assertJsonPath('success', false);

        $this->assertSame(0, EmailChangeRequest::count());
    }
}
