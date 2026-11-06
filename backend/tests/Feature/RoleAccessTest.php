<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * Each role tried against one main page of every portal: a role reaches
 * its own portal and is refused by the others.
 */
#[Group('integration')]
class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    private const PORTALS = [
        'learner' => '/api/student/courses',
        'instructor' => '/api/instructor/classes',
        'academic_admin' => '/api/admin/dashboard',
        'system_admin' => '/api/system-admin/dashboard',
    ];

    public static function roleAndPortal(): array
    {
        $cases = [];
        foreach (array_keys(self::PORTALS) as $role) {
            foreach (self::PORTALS as $portal => $url) {
                $cases["$role on $portal portal"] = [$role, $portal, $role === $portal];
            }
        }

        return $cases;
    }

    public static function portals(): array
    {
        return array_map(fn ($url) => [$url], self::PORTALS);
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    #[DataProvider('portals')]
    public function test_unauthenticated_requests_are_refused(string $url): void
    {
        $this->getJson($url)->assertUnauthorized();
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    #[DataProvider('roleAndPortal')]
    public function test_each_role_reaches_only_its_own_portal(string $role, string $portal, bool $allowed): void
    {
        $user = User::factory()->create(['role' => $role, 'school_id' => 'RA-' . $role, 'is_active' => true]);

        $response = $this->actingAs($user)->getJson(self::PORTALS[$portal]);

        $allowed ? $response->assertOk() : $response->assertForbidden();
    }
}
