<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class InstructorImportTest extends TestCase
{
    use RefreshDatabase;

    private function spreadsheet(array $rows): UploadedFile
    {
        $book = new Spreadsheet();
        $sheet = $book->getActiveSheet();
        $sheet->fromArray([['Instructor Name', 'School ID', 'Email', 'Program', 'Contact']], null, 'A1');

        foreach ($rows as $index => $row) {
            $sheet->fromArray([$row], null, 'A' . ($index + 2));
        }

        $path = tempnam(sys_get_temp_dir(), 'instructor-import-');
        (new Xlsx($book))->save($path);
        $book->disconnectWorksheets();

        return new UploadedFile(
            $path,
            'instructors.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            null,
            true
        );
    }

    public function test_imported_instructors_get_an_8_character_temporary_password(): void
    {
        $admin = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'ADM-IMP',
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin)
            ->postJson('/api/admin/instructors/import', [
                'file' => $this->spreadsheet([
                    ['First Instructor', 'INS-101', 'first@x.edu', 'BSIT', ''],
                    ['Second Instructor', 'INS-102', '', 'BSIT', ''],
                ]),
            ])
            ->assertSuccessful();

        $instructors = $response->json('instructors');
        $this->assertCount(2, $instructors);

        foreach ($instructors as $item) {
            $password = $item['temporary_password'];

            $this->assertSame(8, strlen($password));
            // Only easy-to-read letters and digits.
            $this->assertMatchesRegularExpression('/^[A-HJ-NP-Za-km-np-z2-9]{8}$/', $password);

            $instructor = User::where('school_id', $item['school_id'])->firstOrFail();
            $this->assertTrue(Hash::check($password, $instructor->password));
            $this->assertFalse($instructor->password_setup_complete);
            $this->assertSame($admin->id, $instructor->owner_admin_id);
        }

        // Each instructor gets their own password.
        $this->assertNotSame($instructors[0]['temporary_password'], $instructors[1]['temporary_password']);

        // The 8-character password works for the first login, which then
        // requires choosing their own password.
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', [
            'school_id' => 'INS-101',
            'password' => $instructors[0]['temporary_password'],
            'agree_terms' => true,
        ])->assertOk()->assertJsonPath('first_login', true);
    }
}
