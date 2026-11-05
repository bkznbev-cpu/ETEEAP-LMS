<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * The Module Library is kept in the database and shared by every
 * Academic Admin.
 */
#[Group('integration')]
class ModuleLibrarySharingTest extends TestCase
{
    use RefreshDatabase;

    private function admin(string $schoolId): User
    {
        return User::factory()->create(['role' => 'academic_admin', 'school_id' => $schoolId, 'is_active' => true]);
    }

    private function library(string $moduleTitle): string
    {
        // Sent as JSON text, exactly as the page stores it.
        return json_encode([
            'version' => 'v3',
            'deletedPrograms' => [],
            'programs' => [
                'BSIT' => [
                    'code' => 'BSIT',
                    'courses' => [],
                    'modules' => [['id' => 'module-1', 'title' => $moduleTitle, 'files' => new \stdClass()]],
                ],
            ],
        ]);
    }

    #[Group('FR-ML'), Group('FR-ML-01')]
    public function test_library_is_empty_until_first_saved(): void
    {
        $this->actingAs($this->admin('ADM-L1'))
            ->getJson('/api/admin/module-library')
            ->assertOk()
            ->assertJsonPath('library', null)
            ->assertJsonPath('revision', 0);
    }

    #[Group('FR-ML'), Group('FR-ML-01')]
    public function test_one_admin_saves_and_every_admin_gets_the_same_library(): void
    {
        $adminA = $this->admin('ADM-L1');
        $adminB = $this->admin('ADM-L2');
        $library = $this->library('Intro');

        $this->actingAs($adminA)
            ->putJson('/api/admin/module-library', ['library' => $library, 'revision' => 0])
            ->assertOk()
            ->assertJsonPath('revision', 1);

        // Stored exactly as sent (an empty {} stays {}).
        $this->actingAs($adminB)
            ->getJson('/api/admin/module-library')
            ->assertOk()
            ->assertJsonPath('library', $library)
            ->assertJsonPath('revision', 1);

        $this->assertDatabaseHas('module_library', ['revision' => 1, 'updated_by' => $adminA->id]);
        $this->assertDatabaseHas('audit_logs', ['target_type' => 'module_library']);
    }

    #[Group('FR-ML'), Group('FR-ML-01')]
    public function test_a_save_based_on_an_old_copy_is_refused_with_the_latest(): void
    {
        $adminA = $this->admin('ADM-L1');
        $adminB = $this->admin('ADM-L2');

        $this->actingAs($adminA)
            ->putJson('/api/admin/module-library', ['library' => $this->library('First'), 'revision' => 0])
            ->assertOk();

        $this->actingAs($adminA)
            ->putJson('/api/admin/module-library', ['library' => $this->library('Second'), 'revision' => 1])
            ->assertOk()
            ->assertJsonPath('revision', 2);

        // Admin B still has revision 1.
        $this->actingAs($adminB)
            ->putJson('/api/admin/module-library', ['library' => $this->library('Stale'), 'revision' => 1])
            ->assertStatus(409)
            ->assertJsonPath('conflict', true)
            ->assertJsonPath('library', $this->library('Second'))
            ->assertJsonPath('revision', 2);

        $this->assertDatabaseCount('module_library', 1);
    }

    #[Group('FR-ML'), Group('FR-ML-01')]
    public function test_invalid_data_is_refused(): void
    {
        $admin = $this->actingAs($this->admin('ADM-L1'));

        $admin->putJson('/api/admin/module-library', ['library' => 'not json', 'revision' => 0])->assertStatus(422);
        $admin->putJson('/api/admin/module-library', ['library' => json_encode(['version' => 'v3']), 'revision' => 0])->assertStatus(422);
        $admin->putJson('/api/admin/module-library', ['revision' => 0])->assertStatus(422);
    }

    #[Group('FR-ML'), Group('NFR-S'), Group('NFR-S-02')]
    public function test_only_academic_admins_can_use_the_library(): void
    {
        foreach (['learner', 'instructor', 'system_admin'] as $i => $role) {
            $user = User::factory()->create(['role' => $role, 'school_id' => 'U-' . $i, 'is_active' => true]);

            $this->actingAs($user)->getJson('/api/admin/module-library')->assertForbidden();
            $this->actingAs($user)
                ->putJson('/api/admin/module-library', ['library' => $this->library('X'), 'revision' => 0])
                ->assertForbidden();
        }

        $this->assertDatabaseCount('module_library', 0);
    }
}
