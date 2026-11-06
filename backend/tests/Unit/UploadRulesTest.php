<?php

namespace Tests\Unit;

use App\Support\UploadRules;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * The file rules for submissions and Module Library uploads, checked on
 * their own. Uses Tests\TestCase only because Laravel's validator needs
 * the app container; no database and no HTTP request.
 */
#[Group('unit')]
class UploadRulesTest extends TestCase
{
    private function passes(array $rules, UploadedFile $file): bool
    {
        return Validator::make(['file' => $file], ['file' => $rules])->passes();
    }

    #[Group('FR-SM'), Group('FR-SM-01')]
    public function test_allowed_submission_file_types_are_accepted(): void
    {
        foreach (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'] as $ext) {
            $this->assertTrue(
                $this->passes(UploadRules::submissionFile(), UploadedFile::fake()->create("work.$ext", 100)),
                "A .$ext submission should be accepted."
            );
        }
    }

    #[Group('FR-SM'), Group('FR-SM-01')]
    public function test_other_submission_file_types_are_rejected(): void
    {
        foreach (['exe', 'zip', 'txt', 'pptx', 'mp4', 'html'] as $ext) {
            $this->assertFalse(
                $this->passes(UploadRules::submissionFile(), UploadedFile::fake()->create("work.$ext", 100)),
                "A .$ext submission should be rejected."
            );
        }
    }

    #[Group('FR-SM'), Group('FR-SM-01')]
    public function test_submission_file_of_10_mb_is_accepted(): void
    {
        $this->assertTrue($this->passes(UploadRules::submissionFile(), UploadedFile::fake()->create('work.pdf', 10240)));
    }

    #[Group('FR-SM'), Group('FR-SM-01')]
    public function test_submission_file_over_10_mb_is_rejected(): void
    {
        $this->assertFalse($this->passes(UploadRules::submissionFile(), UploadedFile::fake()->create('work.pdf', 10241)));
    }

    #[Group('FR-ML'), Group('FR-ML-03')]
    public function test_allowed_module_file_types_are_accepted(): void
    {
        foreach (['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'] as $ext) {
            $this->assertTrue(
                $this->passes(UploadRules::moduleFile(), UploadedFile::fake()->create("module.$ext", 100)),
                "A .$ext module file should be accepted."
            );
        }
    }

    #[Group('FR-ML'), Group('FR-ML-03')]
    public function test_other_module_file_types_are_rejected(): void
    {
        foreach (['exe', 'zip', 'txt', 'pptx', 'mp4'] as $ext) {
            $this->assertFalse(
                $this->passes(UploadRules::moduleFile(), UploadedFile::fake()->create("module.$ext", 100)),
                "A .$ext module file should be rejected."
            );
        }
    }

    #[Group('FR-ML'), Group('FR-ML-03')]
    public function test_module_file_of_25_mb_is_accepted(): void
    {
        $this->assertTrue($this->passes(UploadRules::moduleFile(), UploadedFile::fake()->create('module.pdf', 25600)));
    }

    #[Group('FR-ML'), Group('FR-ML-03')]
    public function test_module_file_over_25_mb_is_rejected(): void
    {
        $this->assertFalse($this->passes(UploadRules::moduleFile(), UploadedFile::fake()->create('module.pdf', 25601)));
    }

    #[Group('FR-SM'), Group('FR-SM-01'), Group('FR-ML'), Group('FR-ML-03')]
    public function test_a_file_is_required(): void
    {
        $this->assertFalse(Validator::make([], ['file' => UploadRules::submissionFile()])->passes());
        $this->assertFalse(Validator::make([], ['file' => UploadRules::moduleFile()])->passes());
    }
}
