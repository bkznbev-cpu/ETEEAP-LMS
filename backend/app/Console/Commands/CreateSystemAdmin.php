<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Rules\EmailDomainExists;
use App\Rules\UniqueEmail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

/**
 * Creates a System Administrator, or resets one's password with --reset.
 *
 *   php artisan siknayan:system-admin SYS-0001 --name="Juan Dela Cruz"
 *
 * The password is asked for twice and never shown. For scripts, set
 * SIKNAYAN_SYSTEM_ADMIN_PASSWORD instead.
 */
class CreateSystemAdmin extends Command
{
    protected $signature = 'siknayan:system-admin
        {school_id : Login ID for the account, e.g. SYS-0001}
        {--name=System Administrator : Display name}
        {--email= : Optional email address}
        {--reset : Reset the password of an existing System Administrator}';

    protected $description = 'Create a System Administrator account (or reset its password)';

    private const MIN_PASSWORD_LENGTH = 12;

    public function handle(): int
    {
        $schoolId = trim($this->argument('school_id'));
        $existing = User::where('school_id', $schoolId)->first();

        if ($existing && !$this->option('reset')) {
            $this->error("An account with ID {$schoolId} already exists. Use --reset to change a System Administrator's password.");
            return self::FAILURE;
        }

        if ($existing && $existing->role !== 'system_admin') {
            $this->error("{$schoolId} belongs to a {$existing->role} account, not a System Administrator.");
            return self::FAILURE;
        }

        if (!$existing && $this->option('reset')) {
            $this->error("No account with ID {$schoolId} exists.");
            return self::FAILURE;
        }

        $email = $this->option('email') ?: null;
        $validator = Validator::make(
            ['email' => $email],
            ['email' => ['nullable', 'email', 'max:255', new EmailDomainExists(), new UniqueEmail($existing?->id)]]
        );

        if ($validator->fails()) {
            $this->error($validator->errors()->first('email'));
            return self::FAILURE;
        }

        $password = $this->readPassword();

        if ($password === null) {
            return self::FAILURE;
        }

        if ($existing) {
            $existing->forceFill([
                'password' => Hash::make($password),
                'password_setup_complete' => true,
                'is_active' => true,
            ])->save();
            $existing->tokens()->delete();

            $this->info("Password reset for System Administrator {$schoolId}. Their other sessions were logged out.");
            return self::SUCCESS;
        }

        User::create([
            'name' => $this->option('name'),
            'school_id' => $schoolId,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'system_admin',
            // The login page refuses System Admins on a temporary password,
            // so the person running this command sets the real one here.
            'password_setup_complete' => true,
            'is_active' => true,
        ]);

        $this->info("System Administrator {$schoolId} created. Log in with this ID on the normal login page.");
        return self::SUCCESS;
    }

    private function readPassword(): ?string
    {
        $password = env('SIKNAYAN_SYSTEM_ADMIN_PASSWORD');

        if (!$password) {
            if (!$this->input->isInteractive()) {
                $this->error('No terminal to ask for a password. Set SIKNAYAN_SYSTEM_ADMIN_PASSWORD instead.');
                return null;
            }

            $password = (string) $this->secret('Password (at least ' . self::MIN_PASSWORD_LENGTH . ' characters)');
            $confirmation = (string) $this->secret('Type the password again');

            if ($password !== $confirmation) {
                $this->error('The passwords do not match.');
                return null;
            }
        }

        if (mb_strlen($password) < self::MIN_PASSWORD_LENGTH) {
            $this->error('The password must be at least ' . self::MIN_PASSWORD_LENGTH . ' characters.');
            return null;
        }

        return $password;
    }
}
