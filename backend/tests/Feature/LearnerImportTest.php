<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

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
}
