<?php

namespace Tests\Feature;

use App\Models\Module;
use App\Models\ModuleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Group;
use Tests\Concerns\BuildsClassroom;
use Tests\TestCase;

/**
 * The activities of a module file are found as soon as the module is
 * assigned to a class, and saved as that class's activity list.
 */
#[Group('integration')]
class ActivityDetectionOnAssignmentTest extends TestCase
{
    use RefreshDatabase;
    use BuildsClassroom;

    protected function setUp(): void
    {
        parent::setUp();

        if (!class_exists(\ZipArchive::class)) {
            $this->markTestSkipped('The zip extension is not loaded.');
        }

        Storage::fake('local');
        $this->buildClassroom();
    }

    /** A Word file with the given paragraphs, stored as a module file. */
    private function storeDocx(string $name, array $paragraphs): string
    {
        $file = tempnam(sys_get_temp_dir(), 'docx');
        $zip = new \ZipArchive();
        $zip->open($file, \ZipArchive::OVERWRITE);
        $zip->addFromString('word/document.xml', '<w:document xmlns:w="w"><w:body>'
            . implode('', array_map(fn ($text) => '<w:p><w:r><w:t>' . htmlspecialchars($text) . '</w:t></w:r></w:p>', $paragraphs))
            . '</w:body></w:document>');
        $zip->close();

        $path = Module::MATERIAL_FOLDER . $name;
        Storage::disk('local')->put($path, file_get_contents($file));
        @unlink($file);

        return $path;
    }

    private function assign(string $path)
    {
        $this->libraryCourseFor($this->class, ['BSCRIM-LAW1-M2'], 'LAW1');

        return $this->actingAs($this->admin)->putJson("/api/admin/classes/{$this->class->id}/modules/sync", [
            'modules' => [[
                'library_key' => 'BSCRIM-LAW1-M2', 'title' => 'Module 2', 'is_published' => true,
                'material_path' => $path, 'material_name' => 'module2.docx',
            ]],
        ]);
    }

    private function listOf(Module $module): array
    {
        return ModuleActivity::where('module_id', $module->id)->orderBy('position')
            ->get(['title', 'description', 'max_score'])->toArray();
    }

    public function test_activities_are_saved_when_the_module_is_assigned_to_a_class(): void
    {
        $path = $this->storeDocx('module2.docx', [
            'Activity 1 – Introduction to Programming',
            'Write a short essay.',
            'Activity 2 – Variables and Data Types',
            'Activity 3 – Basic Programming Exercises',
        ]);

        $this->assign($path)->assertOk();

        $module = Module::where('course_id', $this->class->id)->where('library_key', 'BSCRIM-LAW1-M2')->firstOrFail();
        $this->assertSame([
            ['title' => 'Introduction to Programming', 'description' => 'Write a short essay.', 'max_score' => null],
            ['title' => 'Variables and Data Types', 'description' => null, 'max_score' => null],
            ['title' => 'Basic Programming Exercises', 'description' => null, 'max_score' => null],
        ], $this->listOf($module));

        // The instructor's card gets them, still waiting for their Overs.
        $this->actingAs($this->instructor)
            ->getJson("/api/instructor/modules/{$module->id}/activities")
            ->assertOk()
            ->assertJsonPath('source', 'detected')
            ->assertJsonCount(3, 'activities');

        // Saving the class again does not add them twice.
        $this->assign($path)->assertOk();
        $this->assertCount(3, $this->listOf($module));
    }

    public function test_a_new_file_replaces_the_list_only_until_the_instructor_sets_an_over(): void
    {
        $this->assign($this->storeDocx('v1.docx', ['Activity 1 – Old', 'Activity 2 – Old too']))->assertOk();
        $module = Module::where('course_id', $this->class->id)->where('library_key', 'BSCRIM-LAW1-M2')->firstOrFail();
        $this->assertCount(2, $this->listOf($module));

        // New file, no Over set yet: the list follows the file.
        $v2 = $this->storeDocx('v2.docx', ['Activity 1 – New']);
        $this->actingAs($this->admin)
            ->putJson('/api/admin/module-library/BSCRIM-LAW1-M2/material', ['material_path' => $v2, 'material_name' => 'v2.docx'])
            ->assertOk();
        $this->assertSame([['title' => 'New', 'description' => null, 'max_score' => null]], $this->listOf($module));

        // Once the instructor sets an Over, a newer file leaves the list alone.
        ModuleActivity::where('module_id', $module->id)->update(['max_score' => 20]);
        $v3 = $this->storeDocx('v3.docx', ['Activity 1 – Newer', 'Activity 2 – Extra']);
        $this->actingAs($this->admin)
            ->putJson('/api/admin/module-library/BSCRIM-LAW1-M2/material', ['material_path' => $v3, 'material_name' => 'v3.docx'])
            ->assertOk();
        $this->assertSame([['title' => 'New', 'description' => null, 'max_score' => 20]], $this->listOf($module));
    }

    public function test_a_file_that_cannot_be_read_does_not_stop_the_assignment(): void
    {
        $path = Module::MATERIAL_FOLDER . 'broken.docx';
        Storage::disk('local')->put($path, 'not a zip file');

        $this->assign($path)->assertOk();

        $module = Module::where('course_id', $this->class->id)->where('library_key', 'BSCRIM-LAW1-M2')->firstOrFail();
        $this->assertSame([], $this->listOf($module));
    }
}
