<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ModuleMaterialTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $schoolId): User
    {
        return User::factory()->create([
            'role' => $role,
            'school_id' => $schoolId,
            'is_active' => true,
        ]);
    }

    private function course(?User $instructor = null, ?User $owner = null): Course
    {
        return Course::create([
            'owner_admin_id' => $owner?->id,
            'name' => 'Programming 1',
            'code' => 'PROG-' . fake()->unique()->numberBetween(100, 999),
            'instructor_id' => $instructor?->id,
            'is_active' => true,
        ]);
    }

    /** Uploads a file the way the module library does and returns its stored path. */
    private function upload(User $admin, string $name = 'Intro to Dart.pdf', string $content = 'PDF-CONTENT'): string
    {
        $response = $this->actingAs($admin)
            ->post('/api/admin/module-files', [
                'file' => UploadedFile::fake()->createWithContent($name, $content),
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        return $response->json('file_path');
    }

    public function test_sync_keeps_the_stored_path_and_the_display_name(): void
    {
        Storage::fake('local');
        $admin = $this->user('academic_admin', 'ADM-M1');
        $course = $this->course(null, $admin);
        $path = $this->upload($admin);

        $this->assertStringStartsWith('module-materials/', $path);

        $this->actingAs($admin)
            ->putJson("/api/admin/classes/{$course->id}/modules/sync", [
                'modules' => [[
                    'library_key' => 'module-1',
                    'title' => 'Intro to Dart',
                    'material_path' => $path,
                    'material_name' => 'Intro to Dart.pdf',
                    'module_order' => 1,
                    'is_published' => true,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('modules.0.material_name', 'Intro to Dart.pdf')
            ->assertJsonPath('modules.0.has_material', true);

        $this->assertDatabaseHas('modules', [
            'course_id' => $course->id,
            'material_path' => $path,
            'material_name' => 'Intro to Dart.pdf',
        ]);
    }

    public function test_a_display_name_or_missing_file_is_refused_as_a_path(): void
    {
        Storage::fake('local');
        $admin = $this->user('academic_admin', 'ADM-M2');
        $course = $this->course(null, $admin);

        $sync = fn (?string $path) => $this->actingAs($admin)
            ->putJson("/api/admin/classes/{$course->id}/modules/sync", [
                'modules' => [[
                    'library_key' => 'module-1',
                    'title' => 'Intro',
                    'material_path' => $path,
                    'material_name' => 'notes.pdf',
                ]],
            ]);

        // The old bug: the display name sent as the path.
        $sync('notes.pdf')->assertStatus(422)->assertJsonValidationErrors(['modules.0.material_path']);
        // Path tricks.
        $sync('module-materials/../../.env')->assertStatus(422);
        // Right folder, but no such file.
        $sync('module-materials/does-not-exist.pdf')->assertStatus(422);
        // No file at all is fine.
        $sync(null)->assertOk();

        $this->actingAs($admin)
            ->postJson("/api/admin/classes/{$course->id}/modules", [
                'title' => 'Direct',
                'material_path' => 'notes.pdf',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['material_path']);
    }

    public function test_enrolled_learner_downloads_the_right_file_under_its_original_name(): void
    {
        Storage::fake('local');
        $admin = $this->user('academic_admin', 'ADM-M3');
        $learner = $this->user('learner', '24-M0001');
        $course = $this->course();
        $course->learners()->attach($learner->id);

        $path = $this->upload($admin, 'Server-Client Activity.pdf', 'THE-REAL-FILE');
        $module = Module::create([
            'course_id' => $course->id,
            'title' => 'Server Client',
            'material_path' => $path,
            'material_name' => 'Server-Client Activity.pdf',
            'is_published' => true,
        ]);

        // The module page says a file is available, without revealing where it's stored.
        $this->actingAs($learner)
            ->getJson("/api/student/modules/{$module->id}")
            ->assertOk()
            ->assertJsonPath('module.has_material', true)
            ->assertJsonPath('module.material_name', 'Server-Client Activity.pdf')
            ->assertJsonMissingPath('module.material_path');

        $response = $this->actingAs($learner)
            ->get("/api/student/modules/{$module->id}/material")
            ->assertOk();

        $this->assertSame('THE-REAL-FILE', $response->streamedContent());
        $this->assertStringContainsString('Server-Client Activity.pdf', $response->headers->get('content-disposition'));
    }

    public function test_others_cannot_download(): void
    {
        Storage::fake('local');
        $admin = $this->user('academic_admin', 'ADM-M4');
        $instructor = $this->user('instructor', 'INS-M1');
        $enrolled = $this->user('learner', '24-M0002');
        $outsider = $this->user('learner', '24-M0003');
        $course = $this->course($instructor);
        $course->learners()->attach($enrolled->id);

        $path = $this->upload($admin);
        $published = Module::create([
            'course_id' => $course->id, 'title' => 'Published',
            'material_path' => $path, 'material_name' => 'a.pdf', 'is_published' => true,
        ]);
        $draft = Module::create([
            'course_id' => $course->id, 'title' => 'Draft',
            'material_path' => $path, 'material_name' => 'a.pdf', 'is_published' => false,
        ]);

        $url = "/api/student/modules/{$published->id}/material";

        // Not logged in (the upload above logged in as the admin, so log out first).
        $this->app['auth']->forgetGuards();
        $this->getJson($url)->assertUnauthorized();
        $this->actingAs($outsider)->getJson($url)->assertForbidden();
        $this->actingAs($instructor)->getJson($url)->assertForbidden();
        $this->actingAs($admin)->getJson($url)->assertForbidden();
        $this->actingAs($enrolled)->getJson("/api/student/modules/{$draft->id}/material")->assertNotFound();
        $this->actingAs($enrolled)->get($url)->assertOk();
    }

    public function test_only_pdf_images_word_and_excel_can_be_uploaded(): void
    {
        Storage::fake('local');
        $admin = $this->user('academic_admin', 'ADM-M5');

        foreach (['notes.pdf', 'diagram.png', 'photo.jpg', 'photo.jpeg', 'photo.webp',
            'notes.docx', 'old-notes.doc', 'sheet.xlsx', 'old-sheet.xls'] as $name) {
            $this->upload($admin, $name);
        }

        foreach (['slides.pptx', 'archive.zip', 'page.html', 'script.php'] as $name) {
            $this->actingAs($admin)
                ->post('/api/admin/module-files', [
                    'file' => UploadedFile::fake()->createWithContent($name, 'X'),
                ], ['Accept' => 'application/json'])
                ->assertStatus(422)
                ->assertJsonPath('errors.file.0', 'Upload a PDF, an image (JPG, PNG), a Word file (DOC, DOCX) or an Excel file (XLS, XLSX).');
        }
    }

    public function test_learner_can_view_the_file_in_the_browser(): void
    {
        Storage::fake('local');
        $admin = $this->user('academic_admin', 'ADM-M6');
        $learner = $this->user('learner', '24-M0006');
        $course = $this->course();
        $course->learners()->attach($learner->id);
        $path = $this->upload($admin, 'Handout.pdf', '%PDF-1.4 content');
        $module = Module::create([
            'course_id' => $course->id, 'title' => 'Handout',
            'material_path' => $path, 'material_name' => 'Handout.pdf', 'is_published' => true,
        ]);

        $view = $this->actingAs($learner)
            ->get("/api/student/modules/{$module->id}/material?disposition=inline")
            ->assertOk();
        $this->assertStringStartsWith('inline', $view->headers->get('content-disposition'));
        $this->assertSame('nosniff', $view->headers->get('x-content-type-options'));

        $download = $this->actingAs($learner)
            ->get("/api/student/modules/{$module->id}/material")
            ->assertOk();
        $this->assertStringStartsWith('attachment', $download->headers->get('content-disposition'));
    }

    public function test_replacing_a_library_file_updates_every_class_using_it(): void
    {
        Storage::fake('local');
        $admin = $this->user('academic_admin', 'ADM-M7');
        $other = $this->user('academic_admin', 'ADM-M8');
        $old = $this->upload($admin, 'v1.pdf', 'VERSION-1');
        $new = $this->upload($admin, 'v2.pdf', 'VERSION-2');

        $classOne = $this->course(null, $admin);
        $classTwo = $this->course(null, $admin);
        $otherAdminsClass = $this->course(null, $other);
        foreach ([$classOne, $classTwo, $otherAdminsClass] as $class) {
            Module::create([
                'course_id' => $class->id, 'library_key' => 'module-shared', 'title' => 'Shared',
                'material_path' => $old, 'material_name' => 'v1.pdf', 'is_published' => true,
            ]);
        }

        $this->actingAs($admin)
            ->putJson('/api/admin/module-library/module-shared/material', [
                'material_path' => $new,
                'material_name' => 'v2.pdf',
            ])
            ->assertOk()
            ->assertJsonPath('updated_classes', 2);

        $this->assertSame(2, Module::where('material_path', $new)->where('material_name', 'v2.pdf')->count());
        // Another admin's class is not touched; the old file is kept.
        $this->assertDatabaseHas('modules', ['course_id' => $otherAdminsClass->id, 'material_path' => $old]);
        Storage::disk('local')->assertExists($old);

        // A display name or a missing file is refused.
        $this->actingAs($admin)
            ->putJson('/api/admin/module-library/module-shared/material', ['material_path' => 'v2.pdf'])
            ->assertStatus(422);
        $this->actingAs($admin)
            ->putJson('/api/admin/module-library/module-shared/material', [])
            ->assertStatus(422);
    }

    public function test_old_records_holding_only_a_display_name_are_not_offered_or_served(): void
    {
        Storage::fake('local');
        $learner = $this->user('learner', '24-M0004');
        $course = $this->course();
        $course->learners()->attach($learner->id);

        // What the bug saved before this fix.
        $module = Module::create([
            'course_id' => $course->id,
            'title' => 'Old',
            'material_path' => 'bakisan_intro_to_dart.pdf',
            'is_published' => true,
        ]);

        $this->actingAs($learner)
            ->getJson("/api/student/modules/{$module->id}")
            ->assertOk()
            ->assertJsonPath('module.has_material', false);

        $this->actingAs($learner)
            ->getJson("/api/student/modules/{$module->id}/material")
            ->assertNotFound();
    }
}
