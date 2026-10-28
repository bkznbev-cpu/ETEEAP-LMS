<?php

namespace Tests\Feature;

use App\Models\User;
use App\Rules\EmailDomainExists;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Email addresses whose domain doesn't exist are refused. These tests look
 * domains up on the internet, so they are skipped when offline.
 */
class EmailDomainExistsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (!checkdnsrr('gmail.com.', 'MX')) {
            $this->markTestSkipped('No internet: domain lookups are not possible.');
        }

        config(['siknayan.check_email_domains' => true]);
    }

    public function test_real_and_fake_domains(): void
    {
        $this->assertTrue(EmailDomainExists::check('juan@gmail.com'));
        $this->assertTrue(EmailDomainExists::check('Juan@GMAIL.com'));
        $this->assertFalse(EmailDomainExists::check('juan@gmial.con'));
        $this->assertFalse(EmailDomainExists::check('juan@no-such-school-xyz123.invalid'));
        $this->assertFalse(EmailDomainExists::check('juan@localhost'));
    }

    public function test_setup_email_step_refuses_a_fake_domain(): void
    {
        $learner = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-DOM01', 'email' => null,
            'password_setup_complete' => true, 'is_active' => true,
        ]);

        $this->actingAs($learner)->postJson('/api/account/email', ['email' => 'juan@gmial.con'])
            ->assertStatus(422)->assertJsonPath('errors.email.0', EmailDomainExists::MESSAGE);
        $this->assertNull($learner->fresh()->email);

        $this->actingAs($learner)->postJson('/api/account/email', ['email' => 'juan.test@gmail.com'])
            ->assertOk();
    }

    public function test_change_email_refuses_a_fake_domain(): void
    {
        $learner = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-DOM02', 'email' => 'old@gmail.com', 'is_active' => true,
        ]);

        $this->actingAs($learner)->postJson('/api/account/email-change', [
            'new_email' => 'new@gmial.con', 'current_password' => 'password',
        ])->assertStatus(422)->assertJsonPath('errors.new_email.0', EmailDomainExists::MESSAGE);
    }
}
