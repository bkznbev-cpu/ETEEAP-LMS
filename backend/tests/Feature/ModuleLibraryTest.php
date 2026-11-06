<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Group;
use Tests\Concerns\BuildsClassroom;
use Tests\TestCase;

/**
 * Module Library file uploads (FR-ML-03).
 */
#[Group('integration')]
class ModuleLibraryTest extends TestCase
{
    use RefreshDatabase;
    use BuildsClassroom;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->buildClassroom();
    }

    #[Group('FR-ML'), Group('FR-ML-03')]
    public function test_academic_administrator_can_upload_module_file(): void
    {
        $this->actingAs($this->admin)
            ->post('/api/admin/module-files', [
                'file' => UploadedFile::fake()->createWithContent('lesson.pdf', '%PDF-1.4 lesson'),
            ], ['Accept' => 'application/json'])
            ->assertCreated();
    }

    #[Group('FR-ML'), Group('FR-ML-03')]
    public function test_module_upload_rejects_file_over_25_mb(): void
    {
        $this->actingAs($this->admin)
            ->post('/api/admin/module-files', [
                'file' => UploadedFile::fake()->create('big.pdf', 25601),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    #[Group('FR-ML'), Group('NFR-S'), Group('FR-ML-03'), Group('NFR-S-02')]
    public function test_instructor_and_learner_cannot_upload_module_library_files(): void
    {
        foreach ([$this->instructor, $this->learner] as $user) {
            $this->actingAs($user)
                ->post('/api/admin/module-files', [
                    'file' => UploadedFile::fake()->createWithContent('lesson.pdf', '%PDF-1.4 lesson'),
                ], ['Accept' => 'application/json'])
                ->assertForbidden();
        }
    }
}
