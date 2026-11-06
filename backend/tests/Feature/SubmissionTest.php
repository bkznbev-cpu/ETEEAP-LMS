<?php

namespace Tests\Feature;

use App\Models\Submission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Group;
use Tests\Concerns\BuildsClassroom;
use Tests\TestCase;

/**
 * Submission gaps not covered by LearnerPortalTest and UnsubmitTest.
 */
#[Group('integration')]
class SubmissionTest extends TestCase
{
    use RefreshDatabase;
    use BuildsClassroom;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->buildClassroom();
    }

    #[Group('FR-SM'), Group('FR-SM-01')]
    public function test_submission_rejects_file_over_10_mb(): void
    {
        $this->submitFile(file: UploadedFile::fake()->create('big.pdf', 10241))
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');

        $this->assertSame(0, Submission::count());
    }

    #[Group('FR-SM'), Group('FR-SM-01')]
    public function test_submission_rejects_unsupported_file_type(): void
    {
        $this->submitFile(file: UploadedFile::fake()->create('virus.exe', 10))
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');

        $this->assertSame(0, Submission::count());
    }

    #[Group('FR-SM'), Group('NFR-S'), Group('FR-SM-01'), Group('NFR-S-02')]
    public function test_learner_cannot_submit_to_a_module_outside_their_classes(): void
    {
        $this->submitFile(module: $this->otherModule)->assertStatus(403);
        $this->assertSame(0, Submission::count());
    }

    #[Group('FR-SM'), Group('FR-SM-02')]
    public function test_instructor_can_view_and_download_submissions_in_their_class(): void
    {
        $submission = $this->submitAndGet();

        $this->actingAs($this->instructor)->getJson('/api/instructor/submissions')
            ->assertOk()
            ->assertJsonFragment(['id' => $submission->id]);

        $this->actingAs($this->instructor)->get("/api/instructor/submissions/{$submission->id}/file")->assertOk();
    }

    #[Group('FR-SM'), Group('NFR-S'), Group('FR-SM-02'), Group('NFR-S-02')]
    public function test_instructor_cannot_download_submissions_from_another_class(): void
    {
        $submission = $this->submitAndGet();

        $this->actingAs($this->otherInstructor)
            ->getJson("/api/instructor/submissions/{$submission->id}/file")
            ->assertStatus(403);

        $this->actingAs($this->otherInstructor)->getJson('/api/instructor/submissions')
            ->assertOk()
            ->assertJsonMissing(['id' => $submission->id]);
    }

    #[Group('FR-SM'), Group('FR-SM-04')]
    public function test_submission_date_and_time_are_recorded(): void
    {
        $this->travelTo(Carbon::parse('2026-10-15 09:30:00'));

        $submission = $this->submitAndGet();

        $this->assertSame('2026-10-15 09:30:00', $submission->submitted_at->format('Y-m-d H:i:s'));
    }
}
