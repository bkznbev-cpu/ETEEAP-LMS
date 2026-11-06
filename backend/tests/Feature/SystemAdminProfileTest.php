<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class SystemAdminProfileTest extends TestCase
{
    use RefreshDatabase;

    private function systemAdmin(array $extra = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'system_admin',
            'school_id' => 'SYS-P1',
            'name' => 'Original Name',
            'email' => 'original@example.com',
            'is_active' => true,
        ], $extra));
    }

    #[Group('supporting')]
    public function test_system_admin_can_view_their_profile(): void
    {
        $admin = $this->systemAdmin();

        $this->actingAs($admin)
            ->getJson('/api/system-admin/profile')
            ->assertOk()
            ->assertJsonPath('profile.name', 'Original Name')
            ->assertJsonPath('profile.email', 'original@example.com')
            ->assertJsonPath('profile.school_id', 'SYS-P1')
            ->assertJsonPath('profile.profile_photo_url', null);
    }

    #[Group('supporting')]
    public function test_profile_changes_are_saved(): void
    {
        $admin = $this->systemAdmin();

        $this->actingAs($admin)
            ->postJson('/api/system-admin/profile', [
                'name' => 'New Name',
                'email' => $admin->email, // unchanged: emails change only after verification
                'school_id' => 'HACKED', // ignored: login ID is read-only
            ])
            ->assertOk()
            ->assertJsonPath('profile.name', 'New Name');

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'name' => 'New Name',
            'email' => $admin->email,
            'school_id' => 'SYS-P1',
        ]);

        // A new email through the profile form is refused.
        $this->actingAs($admin)
            ->postJson('/api/system-admin/profile', ['name' => 'New Name', 'email' => 'new@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
        $this->assertNotSame('new@example.com', $admin->fresh()->email);
    }

    #[Group('supporting')]
    public function test_photo_upload_replaces_and_removes_the_old_file(): void
    {
        Storage::fake('public');
        $admin = $this->systemAdmin();

        $first = $this->actingAs($admin)
            ->post('/api/system-admin/profile', [
                'name' => 'Original Name',
                'photo' => UploadedFile::fake()->image('a.png', 50, 50),
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $firstPath = $admin->fresh()->profile_photo_path;
        Storage::disk('public')->assertExists($firstPath);
        $this->assertNotNull($first->json('profile.profile_photo_url'));

        $this->actingAs($admin)
            ->post('/api/system-admin/profile', [
                'name' => 'Original Name',
                'photo' => UploadedFile::fake()->image('b.jpg', 50, 50),
            ], ['Accept' => 'application/json'])
            ->assertOk();

        Storage::disk('public')->assertMissing($firstPath);

        $this->actingAs($admin)
            ->postJson('/api/system-admin/profile', [
                'name' => 'Original Name',
                'remove_photo' => true,
            ])
            ->assertOk()
            ->assertJsonPath('profile.profile_photo_url', null);

        $this->assertNull($admin->fresh()->profile_photo_path);
    }

    #[Group('supporting')]
    public function test_invalid_input_is_rejected(): void
    {
        $admin = $this->systemAdmin();
        User::factory()->create(['school_id' => 'X-1', 'email' => 'taken@example.com', 'role' => 'learner']);

        $this->actingAs($admin)
            ->postJson('/api/system-admin/profile', ['name' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        $this->actingAs($admin)
            ->postJson('/api/system-admin/profile', ['name' => 'Ok', 'email' => 'taken@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->actingAs($admin)
            ->post('/api/system-admin/profile', [
                'name' => 'Ok',
                'photo' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['photo']);
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    public function test_only_system_admins_can_use_it(): void
    {
        foreach (['academic_admin', 'instructor', 'learner'] as $index => $role) {
            $user = User::factory()->create(['role' => $role, 'school_id' => "P-ROLE-{$index}"]);

            $this->actingAs($user)->getJson('/api/system-admin/profile')->assertForbidden();
            $this->actingAs($user)->postJson('/api/system-admin/profile', ['name' => 'x'])->assertForbidden();
        }
    }
}
