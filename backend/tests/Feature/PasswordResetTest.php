<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private User $learner;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();

        $this->learner = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-RS001', 'name' => 'Ana Cruz',
            'email' => 'ana@example.com', 'is_active' => true,
            'password' => Hash::make('old-password'), 'password_setup_complete' => true,
        ]);
    }

    /** Sends the email with its account's School ID unless one is given. */
    private function requestCode(string $email, ?string $schoolId = null)
    {
        $schoolId ??= User::whereRaw('LOWER(email) = ?', [mb_strtolower($email)])->value('school_id') ?? 'NO-ID';

        return $this->postJson('/api/password/forgot', ['school_id' => $schoolId, 'email' => $email]);
    }

    private function sentCode(User $user): string
    {
        $code = null;
        Notification::assertSentTo($user, ResetPasswordCode::class, function ($notification) use (&$code) {
            $code = $notification->code();
            return true;
        });
        return $code;
    }

    private function reset(string $code, string $password = 'brand-new-pass', string $email = 'ana@example.com', ?string $confirm = null)
    {
        return $this->postJson('/api/password/reset', [
            'email' => $email, 'code' => $code,
            'password' => $password, 'password_confirmation' => $confirm ?? $password,
        ]);
    }

    private function wrong(string $code): string
    {
        return str_pad((string) (((int) $code + 1) % 100000), 5, '0', STR_PAD_LEFT);
    }

    public function test_a_five_digit_code_is_emailed_and_stored_hashed(): void
    {
        $this->requestCode('Ana@Example.com')->assertOk()->assertJsonPath('success', true);

        $code = $this->sentCode($this->learner);
        $this->assertMatchesRegularExpression('/^\d{5}$/', $code);

        // Kept per account (2 accounts may share an email).
        $stored = DB::table('password_reset_tokens')->where('email', 'user:' . $this->learner->id)->value('token');
        $this->assertNotSame($code, $stored);
        $this->assertTrue(Hash::check($code, $stored));

        $mail = (new ResetPasswordCode($code, 15))->toMail($this->learner);
        $this->assertStringContainsString($code, $mail->subject);
        // Authentication, not 'Academic Admin Accounts', for a learner too.
        $this->assertDatabaseHas('audit_logs', ['action' => 'reset_code_sent', 'module' => 'Authentication', 'target_id' => $this->learner->school_id, 'actor_role' => 'learner']);
        $this->assertDatabaseMissing('audit_logs', ['module' => 'Academic Admin Accounts']);
    }

    public function test_an_email_not_used_during_account_setup_fails(): void
    {
        $this->requestCode('nobody@example.com')
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', fn ($message) => str_starts_with($message, 'The School ID and email address do not match'));

        // An email on an account that never finished setup does not count.
        $notSetUp = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-RS004', 'email' => 'new@example.com',
            'is_active' => true, 'password_setup_complete' => false,
        ]);
        $this->requestCode('new@example.com')->assertStatus(422)->assertJsonPath('success', false);

        Notification::assertNotSentTo($notSetUp, ResetPasswordCode::class);
        $this->assertDatabaseCount('password_reset_tokens', 0);

        $this->requestCode('24-RS001')->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_the_school_id_must_belong_to_the_same_account_as_the_email(): void
    {
        $other = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-RS009', 'email' => 'ben@example.com',
            'is_active' => true, 'password_setup_complete' => true,
        ]);

        // Ana's email with Ben's School ID, and a School ID nobody has.
        $this->requestCode('ana@example.com', '24-RS009')->assertStatus(422)->assertJsonPath('success', false);
        $this->requestCode('ana@example.com', '99-99999')->assertStatus(422)->assertJsonPath('success', false);
        Notification::assertNothingSent();

        // Missing School ID.
        $this->postJson('/api/password/forgot', ['email' => 'ana@example.com'])
            ->assertStatus(422)->assertJsonValidationErrors('school_id');

        // The matching School ID works (any letter case).
        $this->requestCode('ana@example.com', '24-rs001')->assertOk();
        Notification::assertSentTo($this->learner, ResetPasswordCode::class);
        Notification::assertNotSentTo($other, ResetPasswordCode::class);
    }

    public function test_a_deactivated_account_is_refused(): void
    {
        $inactive = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-RS003', 'email' => 'x@example.com',
            'is_active' => false, 'password_setup_complete' => true,
        ]);

        $this->requestCode('x@example.com')
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'This account is deactivated. Please contact your administrator.');

        Notification::assertNotSentTo($inactive, ResetPasswordCode::class);
    }

    public function test_verify_then_reset_signs_out_everywhere_and_code_works_once(): void
    {
        $this->learner->createToken('old-device');
        $this->requestCode('ana@example.com');
        $code = $this->sentCode($this->learner);

        $this->postJson('/api/password/verify-code', ['email' => 'ana@example.com', 'code' => $code])
            ->assertOk()->assertJsonPath('success', true);

        $this->reset($code)->assertOk()->assertJsonPath('success', true);

        $this->learner->refresh();
        $this->assertTrue(Hash::check('brand-new-pass', $this->learner->password));
        $this->assertSame(0, $this->learner->tokens()->count());
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'ana@example.com']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'password_reset', 'module' => 'Authentication', 'target_id' => $this->learner->school_id]);

        $this->postJson('/api/login', ['school_id' => '24-RS001', 'password' => 'brand-new-pass'])->assertOk();

        // Used once only.
        $this->reset($code, 'another-pass-1')->assertStatus(422);
    }

    public function test_wrong_codes_are_counted_and_the_code_is_cancelled_after_five(): void
    {
        $this->requestCode('ana@example.com');
        $code = $this->sentCode($this->learner);
        $wrong = $this->wrong($code);

        for ($i = 1; $i <= 4; $i++) {
            $this->postJson('/api/password/verify-code', ['email' => 'ana@example.com', 'code' => $wrong])
                ->assertStatus(422)->assertJsonFragment(['message' => 'The verification code is incorrect or has expired. ' . (5 - $i) . ' ' . (5 - $i === 1 ? 'try' : 'tries') . ' left.']);
        }

        $this->postJson('/api/password/verify-code', ['email' => 'ana@example.com', 'code' => $wrong])
            ->assertStatus(422)->assertJsonPath('message', 'Too many wrong codes. Please request a new code.');

        // Even the right code no longer works.
        $this->reset($code)->assertStatus(422);
        $this->assertTrue(Hash::check('old-password', $this->learner->fresh()->password));
    }

    public function test_expired_code_and_bad_input_are_refused(): void
    {
        $this->requestCode('ana@example.com');
        $code = $this->sentCode($this->learner);

        $this->postJson('/api/password/verify-code', ['email' => 'ana@example.com', 'code' => '12a45'])
            ->assertStatus(422)->assertJsonValidationErrors('code');
        $this->reset($code, 'short')->assertStatus(422)->assertJsonValidationErrors('password');
        $this->reset($code, 'brand-new-pass', 'ana@example.com', 'different-pass')->assertStatus(422)->assertJsonValidationErrors('password');

        $this->travel(16)->minutes();
        $this->reset($code)->assertStatus(422)->assertJsonPath('message', 'The verification code has expired. Please request a new code.');
        $this->assertTrue(Hash::check('old-password', $this->learner->fresh()->password));
    }

    public function test_a_new_code_needs_a_minute_and_replaces_the_old_one(): void
    {
        $this->requestCode('ana@example.com');
        $this->requestCode('ana@example.com')->assertOk();
        Notification::assertSentToTimes($this->learner, ResetPasswordCode::class, 1);

        $first = $this->sentCode($this->learner);
        $this->travel(61)->seconds();
        $this->requestCode('ana@example.com');
        Notification::assertSentToTimes($this->learner, ResetPasswordCode::class, 2);

        // Only the newest code works (unless both happen to be equal).
        $codes = [];
        Notification::assertSentTo($this->learner, ResetPasswordCode::class, function ($n) use (&$codes) {
            $codes[] = $n->code();
            return true;
        });
        if ($codes[0] !== $codes[1]) {
            $this->postJson('/api/password/verify-code', ['email' => 'ana@example.com', 'code' => $first])->assertStatus(422);
        }
        $this->postJson('/api/password/verify-code', ['email' => 'ana@example.com', 'code' => $codes[1]])->assertOk();
    }

    public function test_system_admin_needs_fifteen_characters(): void
    {
        $admin = User::factory()->create(['role' => 'system_admin', 'school_id' => 'SYS-RS', 'email' => 'sys@example.com', 'is_active' => true]);
        $this->requestCode('sys@example.com');
        $code = $this->sentCode($admin);

        $this->reset($code, 'twelve-chars', 'sys@example.com')->assertStatus(422)->assertJsonValidationErrors('password');
        $this->reset($code, 'a long enough passphrase', 'sys@example.com')->assertOk();
    }

    public function test_requests_are_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->requestCode('nobody@example.com')->assertStatus(422);
        }
        $this->requestCode('nobody@example.com')->assertStatus(429);
    }
    public function test_two_accounts_sharing_an_email_reset_only_the_one_asked_for(): void
    {
        $instructor = User::factory()->create([
            'role' => 'instructor', 'school_id' => 'INS-SHARE', 'email' => 'ana@example.com',
            'is_active' => true, 'password_setup_complete' => true,
        ]);
        $learnerPassword = $this->learner->fresh()->password;

        $this->requestCode('ana@example.com', 'INS-SHARE')->assertOk();
        $code = $this->sentCode($instructor);
        Notification::assertNotSentTo($this->learner, ResetPasswordCode::class);

        // Without the School ID the shared email can't pick an account.
        $this->postJson('/api/password/verify-code', ['email' => 'ana@example.com', 'code' => $code])
            ->assertStatus(422);

        $this->postJson('/api/password/reset', [
            'school_id' => 'INS-SHARE', 'email' => 'ana@example.com', 'code' => $code,
            'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass',
        ])->assertOk();

        $this->assertTrue(Hash::check('brand-new-pass', $instructor->fresh()->password));
        $this->assertSame($learnerPassword, $this->learner->fresh()->password);
    }
}
