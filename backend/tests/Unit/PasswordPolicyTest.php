<?php

namespace Tests\Unit;

use App\Support\PasswordPolicy;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * The minimum password length by role, as used by password reset.
 * Uses Tests\TestCase only because Laravel's validator needs the app
 * container; no database and no HTTP request.
 */
#[Group('unit')]
class PasswordPolicyTest extends TestCase
{
    private function passes(string $password, string $role): bool
    {
        $min = PasswordPolicy::minimumLength($role);

        return Validator::make(['password' => $password], ['password' => ['required', 'string', "min:$min"]])->passes();
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_password_with_8_characters_is_valid_for_learners_instructors_and_academic_admins(): void
    {
        foreach (['learner', 'instructor', 'academic_admin'] as $role) {
            $this->assertTrue($this->passes('Abcdefg1', $role), "8 characters should be enough for $role.");
        }
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_password_shorter_than_8_characters_is_invalid(): void
    {
        foreach (['learner', 'instructor', 'academic_admin'] as $role) {
            $this->assertFalse($this->passes('Abcdef1', $role), "7 characters should be refused for $role.");
        }
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_system_administrator_password_shorter_than_15_characters_is_invalid(): void
    {
        $this->assertFalse($this->passes('Abcdefghijklm1', 'system_admin'));
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_system_administrator_password_with_15_characters_is_valid(): void
    {
        $this->assertTrue($this->passes('Abcdefghijklmn1', 'system_admin'));
    }

    #[Group('NFR-S'), Group('NFR-S-03')]
    public function test_unknown_role_uses_the_8_character_minimum(): void
    {
        $this->assertSame(8, PasswordPolicy::minimumLength(null));
    }
}
