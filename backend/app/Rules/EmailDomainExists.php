<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Cache;

/**
 * Refuses an email address whose domain (the part after "@") does not
 * exist or has no mail server, e.g. "juan@gmial.con".
 *
 * Whether the mailbox itself exists can't be checked without sending it
 * a message; the "Change Email" code does that.
 *
 * If this server has no internet (no domain can be looked up at all),
 * addresses are let through instead of refusing everyone.
 * Turn the check off with SIKNAYAN_CHECK_EMAIL_DOMAINS=false.
 */
class EmailDomainExists implements ValidationRule
{
    public const MESSAGE = 'That email address does not exist. Please check the part after "@" (for example gmail.com).';

    /** Domains that are known to work, used to tell "no internet" apart. */
    private const KNOWN_GOOD = ['gmail.com', 'outlook.com', 'yahoo.com'];

    public static function check(?string $email): bool
    {
        if (!config('siknayan.check_email_domains', true)) {
            return true;
        }

        $email = trim((string) $email);
        $at = strrpos($email, '@');

        if ($at === false) {
            return false;
        }

        $domain = mb_strtolower(rtrim(substr($email, $at + 1), '.'));

        if ($domain === '' || !str_contains($domain, '.')) {
            return false;
        }

        $key = 'email-domain:' . $domain;
        $known = Cache::get($key);

        if (is_bool($known)) {
            return $known;
        }

        if (self::domainReceivesMail($domain)) {
            Cache::put($key, true, now()->addDay());
            return true;
        }

        // Nothing resolves: the server is offline, so don't block anyone
        // (and don't remember this domain as bad).
        if (!self::online()) {
            return true;
        }

        Cache::put($key, false, now()->addHour());
        return false;
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && trim($value) !== '' && !self::check($value)) {
            $fail(self::MESSAGE);
        }
    }

    private static function domainReceivesMail(string $domain): bool
    {
        $ascii = function_exists('idn_to_ascii')
            ? (idn_to_ascii($domain, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46) ?: $domain)
            : $domain;

        // A mail server (MX), or an address the mail can go to directly.
        return checkdnsrr($ascii . '.', 'MX')
            || checkdnsrr($ascii . '.', 'A')
            || checkdnsrr($ascii . '.', 'AAAA');
    }

    private static function online(): bool
    {
        foreach (self::KNOWN_GOOD as $domain) {
            if (checkdnsrr($domain . '.', 'MX')) {
                return true;
            }
        }

        return false;
    }
}
