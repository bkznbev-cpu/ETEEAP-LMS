<?php

namespace App\Support;

/**
 * The password rule (NFR-S-03), checked by the server whenever someone
 * chooses their own password: first-time setup, change, and reset.
 *
 * - Learners, Instructors and Academic Admins: at least 8 characters,
 *   with at least one uppercase letter and one number.
 * - System Administrators: at least 15 characters (long passphrases and
 *   spaces allowed, as the System Administrator pages say).
 */
class PasswordPolicy
{
    public const MIN_LENGTH = 8;
    public const SYSTEM_ADMIN_MIN_LENGTH = 15;

    public static function minimumLength(?string $role): int
    {
        return $role === 'system_admin' ? self::SYSTEM_ADMIN_MIN_LENGTH : self::MIN_LENGTH;
    }

    /**
     * Validation rules for a new password chosen by a user with this role.
     * Add 'confirmed' / 'different:...' etc. at the call site as needed.
     */
    public static function rules(?string $role): array
    {
        $rules = ['required', 'string', 'min:' . self::minimumLength($role), 'max:255'];

        if ($role !== 'system_admin') {
            $rules[] = 'regex:/[A-Z]/';
            $rules[] = 'regex:/[0-9]/';
        }

        return $rules;
    }

    /** Error messages for rules(), keyed for the given field name. */
    public static function messages(?string $role, string $field = 'password'): array
    {
        $minimum = self::minimumLength($role);

        return [
            "{$field}.min" => $role === 'system_admin'
                ? "The new password must be at least {$minimum} characters."
                : "The new password must be at least {$minimum} characters, with one uppercase letter and one number.",
            "{$field}.regex" => "The new password must have at least {$minimum} characters, one uppercase letter, and one number.",
        ];
    }
}
