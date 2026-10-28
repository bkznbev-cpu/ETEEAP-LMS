<?php

namespace App\Rules;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * An email address can be used by at most MAX_ACCOUNTS accounts (e.g. the
 * same person as a learner and as an instructor); one more is refused.
 * Capital letters and spaces are ignored, so "Juan@Mail.com" counts as
 * the same address as "juan@mail.com" on every database.
 */
class UniqueEmail implements ValidationRule
{
    public const MAX_ACCOUNTS = 2;

    public const MESSAGE = 'That email address is already used by ' . self::MAX_ACCOUNTS
        . ' accounts. An email address can be used by at most ' . self::MAX_ACCOUNTS . ' accounts.';

    /** @param int|null $ignoreId the account being edited (its own email is allowed) */
    public function __construct(private ?int $ignoreId = null)
    {
    }

    /** True when the address already has the most accounts allowed. */
    public static function taken(?string $email, ?int $ignoreId = null): bool
    {
        $email = mb_strtolower(trim((string) $email));

        if ($email === '') {
            return false;
        }

        return User::whereRaw('LOWER(TRIM(email)) = ?', [$email])
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->count() >= self::MAX_ACCOUNTS;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && self::taken($value, $this->ignoreId)) {
            $fail(self::MESSAGE);
        }
    }
}
