<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('unit')]
class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    #[Group('supporting')]
    public function test_that_true_is_true(): void
    {
        $this->assertTrue(true);
    }
}
