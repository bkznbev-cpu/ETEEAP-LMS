<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class ImportMultipleSheetsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'academic_admin',
            'school_id' => 'ADM-SHEETS',
            'is_active' => true,
        ]);
    }

    /**
     * @param array<string, array<int, array<int, string>>> $sheets name => rows (first row = headers)
     */
    private function workbook(array $sheets, int $activeIndex = 0): UploadedFile
    {
        $book = new Spreadsheet();
        $book->removeSheetByIndex(0);

        foreach ($sheets as $name => $rows) {
            $sheet = $book->createSheet();
            $sheet->setTitle($name);
            $sheet->fromArray($rows, null, 'A1');
        }

        $book->setActiveSheetIndex($activeIndex);

        $path = tempnam(sys_get_temp_dir(), 'sheets-');
        (new Xlsx($book))->save($path);
        $book->disconnectWorksheets();

        return new UploadedFile($path, 'import.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
    }

    private function learnerBook(): UploadedFile
    {
        $header = ['Student Name', 'School ID', 'Email', 'Program', 'Contact'];

        return $this->workbook([
            'Section A' => [$header, ['Ana A', '24-30001', '', 'BSIT', ''], ['Ben A', '24-30002', '', 'BSIT', '']],
            'Section B' => [$header, ['Cara B', '24-30003', '', 'BSIT', '']],
            'Notes' => [['Instructions'], ['Fill one row per learner']],
        ], 1); // "Section B" was the active sheet when saved
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_without_a_choice_only_the_active_sheet_is_imported_as_before(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/learners/import', ['file' => $this->learnerBook()])
            ->assertCreated()
            ->assertJsonPath('imported_count', 1);

        $this->assertDatabaseHas('users', ['school_id' => '24-30003']);
        $this->assertDatabaseMissing('users', ['school_id' => '24-30001']);
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_chosen_sheets_are_imported_together(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/learners/import', [
                'file' => $this->learnerBook(),
                'sheets' => ['Section A', 'Section B'],
            ])
            ->assertCreated()
            ->assertJsonPath('imported_count', 3);

        foreach (['24-30001', '24-30002', '24-30003'] as $id) {
            $this->assertDatabaseHas('users', ['school_id' => $id, 'owner_admin_id' => $this->admin->id]);
        }
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_a_chosen_sheet_without_the_required_columns_is_named_in_the_error(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/learners/import', [
                'file' => $this->learnerBook(),
                'sheets' => ['Section A', 'Notes'],
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Sheet "Notes": Required columns: Student Name and School ID.');

        // Nothing was imported.
        $this->assertDatabaseMissing('users', ['school_id' => '24-30001']);
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_an_unknown_sheet_name_is_refused(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/learners/import', [
                'file' => $this->learnerBook(),
                'sheets' => ['Section Z'],
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'The workbook has no sheet named "Section Z".');
    }

    #[Group('FR-UM'), Group('FR-UM-02')]
    public function test_row_errors_say_which_sheet_and_duplicates_are_caught_across_sheets(): void
    {
        $header = ['Instructor Name', 'School ID', 'Email', 'Program', 'Contact'];
        $book = $this->workbook([
            'Day' => [$header, ['Day One', 'INS-501', '', 'BSIT', '']],
            'Night' => [$header, ['Night One', 'INS-502', '', 'BSIT', ''], ['Repeat', 'INS-501', '', 'BSIT', '']],
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/instructors/import', [
                'file' => $book,
                'sheets' => ['Day', 'Night'],
            ])
            ->assertStatus(422);

        $error = collect($response->json('errors'))->firstWhere('school_id', 'INS-501');
        $this->assertSame('Night', $error['sheet']);
        $this->assertSame(3, $error['row']);
        $this->assertSame('Duplicate School ID in the spreadsheet.', $error['message']);

        // All-or-nothing: no instructor was created.
        $this->assertSame(0, User::where('role', 'instructor')->count());
    }
}
