<?php

namespace Tests\Feature;

use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class LoginValidationTest extends TestCase
{
    #[Group('FR-AU'), Group('FR-AU-01')]
    public function test_login_rejects_missing_credentials(): void
    {
        $response = $this->postJson('/api/login', []);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors([
            'school_id',
            'password',
        ]);
    }

    #[Group('FR-AU'), Group('FR-AU-01')]
    public function test_demo_failed_assertion(): void
    {
        $response = $this->postJson('/api/login', []);

        // Corrected assertion: missing credentials return HTTP 422.
        $response->assertUnprocessable();
    }
}
