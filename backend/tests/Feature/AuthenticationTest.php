<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Group;
use Tests\Concerns\BuildsClassroom;
use Tests\TestCase;

/**
 * Authentication gaps not covered by the older login and password tests.
 */
#[Group('integration')]
class AuthenticationTest extends TestCase
{
    use RefreshDatabase;
    use BuildsClassroom;

    protected function setUp(): void
    {
        parent::setUp();
        $this->buildClassroom();
    }

    #[Group('FR-AU'), Group('FR-AU-01')]
    public function test_login_fails_with_wrong_password(): void
    {
        $this->postJson('/api/login', ['school_id' => $this->learner->school_id, 'password' => 'not-my-password'])
            ->assertUnauthorized()
            ->assertJsonMissingPath('token');
    }

    #[Group('FR-AU'), Group('FR-AU-01')]
    public function test_user_can_log_in_with_valid_school_id_and_password(): void
    {
        $this->postJson('/api/login', ['school_id' => $this->learner->school_id, 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['token']);
    }

    #[Group('FR-AU'), Group('FR-AU-04')]
    public function test_password_change_fails_with_wrong_current_password(): void
    {
        $this->actingAs($this->learner)->putJson('/api/account/password', [
            'current_password' => 'not-my-password',
            'password' => 'NewPassword1',
            'password_confirmation' => 'NewPassword1',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('password', $this->learner->fresh()->password));
    }

    #[Group('NFR-S'), Group('NFR-S-01')]
    public function test_passwords_are_stored_hashed(): void
    {
        $this->actingAs($this->admin)->postJson('/api/admin/learners', [
            'name' => 'Carla Diaz', 'school_id' => '24-00099', 'password' => 'TempPass99',
        ])->assertCreated();

        $stored = User::where('school_id', '24-00099')->value('password');

        $this->assertNotSame('TempPass99', $stored);
        $this->assertStringNotContainsString('TempPass99', $stored);
        $this->assertTrue(Hash::check('TempPass99', $stored));
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_new_password_without_an_uppercase_letter_or_number_is_rejected(): void
    {
        foreach (['alllowercaseletters', 'NoNumbersHere', 'nouppercase123'] as $weak) {
            $this->actingAs($this->learner)->putJson('/api/account/password', [
                'current_password' => 'password',
                'password' => $weak,
                'password_confirmation' => $weak,
            ])->assertStatus(422)->assertJsonValidationErrors('password');
        }

        $this->actingAs($this->learner)->putJson('/api/account/password', [
            'current_password' => 'password',
            'password' => 'GoodPass1',
            'password_confirmation' => 'GoodPass1',
        ])->assertOk();
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_first_time_password_setup_needs_an_uppercase_letter_and_number(): void
    {
        $this->learner->update(['password_setup_complete' => false]);

        $this->actingAs($this->learner)->postJson('/api/student/setup-password', [
            'password' => 'lowercase1',
            'password_confirmation' => 'lowercase1',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_system_administrator_cannot_change_own_password_to_fewer_than_15_characters(): void
    {
        $this->actingAs($this->systemAdmin)->putJson('/api/account/password', [
            'current_password' => 'password',
            'password' => 'Short1Pass',
            'password_confirmation' => 'Short1Pass',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->actingAs($this->systemAdmin)->putJson('/api/account/password', [
            'current_password' => 'password',
            'password' => 'a long passphrase here',
            'password_confirmation' => 'a long passphrase here',
        ])->assertOk();
    }

    #[Group('NFR-S'), Group('NFR-S-04'), Group('discrepancy')]
    public function test_session_expires_after_30_minutes_of_inactivity(): void
    {
        $token = $this->postJson('/api/login', ['school_id' => $this->learner->school_id, 'password' => 'password'])->json('token');
        $this->withToken($token)->getJson('/api/student/courses')->assertOk();

        $this->travel(31)->minutes();
        $this->app['auth']->forgetGuards();

        $response = $this->withToken($token)->getJson('/api/student/courses');

        if ($response->status() === 200) {
            $this->requirementNotMet('NFR-S-04', 'after 31 minutes without activity the login token still works. Tokens expire 8 hours after login (SANCTUM_TOKEN_EXPIRATION=480), whether or not the user is active. No inactivity logout exists in the back end or the web pages.');
        }
        $response->assertUnauthorized();
    }
}
