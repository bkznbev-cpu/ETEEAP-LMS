<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class LearnerImportTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => '99-00001',
            'is_active' => true,
        ]);
    }

    private function spreadsheet(array $rows): UploadedFile
    {
        $book = new Spreadsheet();
        $sheet = $book->getActiveSheet();

        $sheet->fromArray(
            [['Student Name', 'School ID', 'Email', 'Program', 'Contact']],
            null,
            'A1'
        );

        foreach ($rows as $index => $row) {
            $sheet->fromArray([$row], null, 'A' . ($index + 2));
        }

        $path = tempnam(sys_get_temp_dir(), 'learner-import-');
        (new Xlsx($book))->save($path);
        $book->disconnectWorksheets();

        return new UploadedFile(
            $path,
            'learners.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_import_accepts_blank_email_and_reports_skipped_email(): void
    {
        $this->actingAs($this->admin());

        $response = $this->postJson('/api/admin/learners/import', [
            'file' => $this->spreadsheet([
                ['Blank Email Learner', '24-12345', '', 'ETEEAP', ''],
            ]),
        ]);

        $response->assertCreated()
            ->assertJsonPath('imported_count', 1)
            ->assertJsonPath('email_summary.skipped_no_email', 1)
            ->assertJsonPath('learners.0.email_status', 'skipped_no_email')
            ->assertJsonPath('learners.0.email', null);

        $learner = User::where('school_id', '24-12345')->firstOrFail();

        $this->assertSame('learner', $learner->role);
        $this->assertNotEmpty($response->json('learners.0.temporary_password'));
        $this->assertTrue(
            Hash::check(
                $response->json('learners.0.temporary_password'),
                $learner->password
            )
        );
        $this->assertFalse($learner->password_setup_complete);
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_import_ignores_the_email_column(): void
    {
        $this->actingAs($this->admin());

        $response = $this->postJson('/api/admin/learners/import', [
            'file' => $this->spreadsheet([
                ['Email Learner', '24-12347', 'learner@example.com', 'ETEEAP', ''],
                ['Bad Email Learner', '24-12346', 'not-an-email', 'ETEEAP', ''],
            ]),
        ]);

        // Learners add and confirm their own email after first login.
        $response->assertCreated()
            ->assertJsonPath('imported_count', 2)
            ->assertJsonPath('email_summary.skipped_no_email', 2);

        $this->assertDatabaseHas('users', ['school_id' => '24-12347', 'email' => null, 'role' => 'learner']);
        $this->assertDatabaseHas('users', ['school_id' => '24-12346', 'email' => null, 'role' => 'learner']);
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_file_with_an_existing_school_id_is_rejected_and_nothing_is_imported(): void
    {
        $this->actingAs($this->admin());
        User::factory()->create(['role' => 'learner', 'school_id' => '24-20001']);

        $response = $this->postJson('/api/admin/learners/import', [
            'file' => $this->spreadsheet([
                ['New Learner', '24-20002', '', 'ETEEAP', ''],
                ['Existing Learner', '24-20001', '', 'ETEEAP', ''],
            ]),
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('success', false)
            ->assertJsonPath('errors.0.row', 3)
            ->assertJsonPath('errors.0.message', 'School ID 24-20001 already exists in the system.');

        $this->assertStringContainsString('No accounts were created', $response->json('message'));
        // The valid row is not imported either.
        $this->assertDatabaseMissing('users', ['school_id' => '24-20002']);
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_reimporting_the_same_file_says_it_was_already_imported(): void
    {
        $this->actingAs($this->admin());
        $rows = [['First', '24-30001', '', '', ''], ['Second', '24-30002', '', '', '']];

        $this->postJson('/api/admin/learners/import', ['file' => $this->spreadsheet($rows)])->assertCreated();

        $this->postJson('/api/admin/learners/import', ['file' => $this->spreadsheet($rows)])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This file has already been imported. Every School ID in it already exists, so no accounts were created.')
            ->assertJsonCount(2, 'errors');

        $this->assertSame(2, User::whereIn('school_id', ['24-30001', '24-30002'])->count());
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_file_with_a_repeated_school_id_is_rejected_and_nothing_is_imported(): void
    {
        $this->actingAs($this->admin());

        $this->postJson('/api/admin/learners/import', [
            'file' => $this->spreadsheet([
                ['First', '24-40001', '', '', ''],
                ['Copy', '24-40001', '', '', ''],
            ]),
        ])->assertUnprocessable()
            ->assertJsonPath('errors.0.row', 3)
            ->assertJsonPath('errors.0.message', 'Duplicate School ID in the spreadsheet.');

        $this->assertDatabaseMissing('users', ['school_id' => '24-40001']);
    }
}
