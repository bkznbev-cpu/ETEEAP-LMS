<?php

namespace App\Support;

/**
 * Minimum password length by role, used when a password is reset.
 * System Administrators need a longer password than everyone else.
 */
class PasswordPolicy
{
    public const MIN_LENGTH = 8;
    public const SYSTEM_ADMIN_MIN_LENGTH = 15;

    public static function minimumLength(?string $role): int
    {
        return $role === 'system_admin' ? self::SYSTEM_ADMIN_MIN_LENGTH : self::MIN_LENGTH;
    }
}
