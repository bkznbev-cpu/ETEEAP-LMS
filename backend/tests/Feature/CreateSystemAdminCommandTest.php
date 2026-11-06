<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class CreateSystemAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    #[Group('supporting')]
    public function test_creates_a_system_admin_who_can_log_in(): void
    {
        $this->artisan('siknayan:system-admin', ['school_id' => 'SYS-0001', '--name' => 'Demo Admin'])
            ->expectsQuestion('Password (at least 12 characters)', 'a-strong-password')
            ->expectsQuestion('Type the password again', 'a-strong-password')
            ->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'school_id' => 'SYS-0001',
            'name' => 'Demo Admin',
            'role' => 'system_admin',
            'password_setup_complete' => true,
            'is_active' => true,
        ]);

        $this->postJson('/api/login', [
            'school_id' => 'SYS-0001',
            'password' => 'a-strong-password',
        ])->assertOk()
            ->assertJsonPath('user.role', 'system_admin')
            ->assertJsonPath('first_login', false);
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_rejects_mismatched_or_short_passwords(): void
    {
        $this->artisan('siknayan:system-admin', ['school_id' => 'SYS-0002'])
            ->expectsQuestion('Password (at least 12 characters)', 'a-strong-password')
            ->expectsQuestion('Type the password again', 'different-password')
            ->assertFailed();

        $this->artisan('siknayan:system-admin', ['school_id' => 'SYS-0002'])
            ->expectsQuestion('Password (at least 12 characters)', 'short')
            ->expectsQuestion('Type the password again', 'short')
            ->assertFailed();

        $this->assertDatabaseMissing('users', ['school_id' => 'SYS-0002']);
    }

    #[Group('supporting')]
    public function test_will_not_overwrite_an_existing_account(): void
    {
        User::factory()->create(['school_id' => 'ADM-0009', 'role' => 'academic_admin']);

        $this->artisan('siknayan:system-admin', ['school_id' => 'ADM-0009'])->assertFailed();
        $this->artisan('siknayan:system-admin', ['school_id' => 'ADM-0009', '--reset' => true])->assertFailed();

        $this->assertDatabaseHas('users', ['school_id' => 'ADM-0009', 'role' => 'academic_admin']);
    }

    #[Group('supporting')]
    public function test_reset_changes_the_password_and_ends_sessions(): void
    {
        $admin = User::factory()->create([
            'school_id' => 'SYS-0003',
            'role' => 'system_admin',
            'password' => Hash::make('old-password-123'),
        ]);
        $admin->createToken('old-session');

        $this->artisan('siknayan:system-admin', ['school_id' => 'SYS-0003', '--reset' => true])
            ->expectsQuestion('Password (at least 12 characters)', 'new-password-456')
            ->expectsQuestion('Type the password again', 'new-password-456')
            ->assertSuccessful();

        $admin->refresh();
        $this->assertTrue(Hash::check('new-password-456', $admin->password));
        $this->assertSame(0, $admin->tokens()->count());
    }
}
