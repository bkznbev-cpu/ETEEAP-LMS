<?php

namespace Tests\Feature;

use App\Models\AuditLogEntry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * Behind Docker / a reverse proxy: with TRUSTED_PROXIES set, the visitor's
 * real IP (from X-Forwarded-For) is what the audit log records.
 */
#[Group('integration')]
class TrustedProxyIpTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        // Must be set before the app boots (read in bootstrap/app.php).
        putenv('TRUSTED_PROXIES=172.16.0.0/12');
        $_ENV['TRUSTED_PROXIES'] = $_SERVER['TRUSTED_PROXIES'] = '172.16.0.0/12';

        return parent::createApplication();
    }

    protected function tearDown(): void
    {
        putenv('TRUSTED_PROXIES');
        unset($_ENV['TRUSTED_PROXIES'], $_SERVER['TRUSTED_PROXIES']);
        parent::tearDown();
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_real_visitor_ip_is_logged_behind_a_trusted_proxy(): void
    {
        User::factory()->create(['role' => 'learner', 'school_id' => '24-01000', 'password' => Hash::make('right-pass-1'), 'is_active' => true]);

        // From the Docker proxy (trusted): the forwarded visitor IP is used.
        $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.5', 'HTTP_X_FORWARDED_FOR' => '203.0.113.9'])
            ->postJson('/api/login', ['school_id' => '24-01000', 'password' => 'right-pass-1'])->assertOk();
        $this->assertSame('203.0.113.9', AuditLogEntry::where('action', 'sign_in')->latest('id')->value('ip_address'));

        // From anywhere else (not trusted): the header is ignored.
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7', 'HTTP_X_FORWARDED_FOR' => '203.0.113.9'])
            ->postJson('/api/login', ['school_id' => '24-01000', 'password' => 'right-pass-1'])->assertOk();
        $this->assertSame('198.51.100.7', AuditLogEntry::where('action', 'sign_in')->latest('id')->value('ip_address'));
    }
}
