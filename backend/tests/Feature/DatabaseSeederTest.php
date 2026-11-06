<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    #[Group('supporting')]
    public function test_seeder_creates_admin_with_a_temporary_password_not_the_old_default(): void
    {
        $this->seed();

        $admin = User::where('school_id', 'ADMIN-001')->firstOrFail();

        $this->assertSame('academic_admin', $admin->role);
        $this->assertFalse($admin->password_setup_complete);
        $this->assertTrue($admin->is_active);
        $this->assertFalse(Hash::check('admin123', $admin->password));
    }

    #[Group('supporting')]
    public function test_seeding_again_does_not_reset_the_password(): void
    {
        $this->seed();

        $admin = User::where('school_id', 'ADMIN-001')->firstOrFail();
        $admin->update([
            'password' => Hash::make('chosen-by-the-admin'),
            'password_setup_complete' => true,
        ]);

        $this->seed();

        $admin->refresh();
        $this->assertTrue(Hash::check('chosen-by-the-admin', $admin->password));
        $this->assertTrue($admin->password_setup_complete);
        $this->assertSame(1, User::where('school_id', 'ADMIN-001')->count());
    }
}
