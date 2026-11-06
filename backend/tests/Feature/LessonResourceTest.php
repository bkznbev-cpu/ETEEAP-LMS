<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\LessonResource;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class LessonResourceTest extends TestCase
{
    use RefreshDatabase;

    private User $instructor;
    private User $otherInstructor;
    private User $learner;
    private User $outsider;
    private Course $class;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-LR1', 'is_active' => true]);
        $this->otherInstructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-LR2', 'is_active' => true]);
        $this->learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-LR001', 'is_active' => true, 'password_setup_complete' => true]);
        $this->outsider = User::factory()->create(['role' => 'learner', 'school_id' => '24-LR002', 'is_active' => true, 'password_setup_complete' => true]);

        $this->class = Course::create([
            'name' => 'Web Development', 'code' => 'WEB-101', 'is_active' => true,
            'instructor_id' => $this->instructor->id,
        ]);
        $this->class->learners()->attach($this->learner->id);
    }

    private function url(string $suffix = ''): string
    {
        return "/api/instructor/classes/{$this->class->id}/resources{$suffix}";
    }

    #[Group('FR-CM'), Group('FR-CM-06')]
    public function test_instructor_adds_a_link_for_a_module(): void
    {
        $module = Module::create(['course_id' => $this->class->id, 'title' => 'HTML Basics', 'is_published' => true]);

        $this->actingAs($this->instructor)
            ->postJson($this->url(), [
                'type' => 'link',
                'title' => 'Intro video',
                'url' => 'https://www.youtube.com/watch?v=abc',
                'module_id' => $module->id,
            ])
            ->assertCreated()
            ->assertJsonPath('resource.url', 'https://www.youtube.com/watch?v=abc')
            ->assertJsonPath('resource.module_title', 'HTML Basics');

        $this->actingAs($this->instructor)
            ->getJson($this->url())
            ->assertOk()
            ->assertJsonCount(1, 'resources');
    }

    #[Group('FR-CM'), Group('FR-CM-06')]
    public function test_links_must_be_web_addresses(): void
    {
        $this->actingAs($this->instructor)
            ->postJson($this->url(), ['type' => 'link', 'title' => 'Bad', 'url' => 'javascript:alert(1)'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('url');
    }

    #[Group('FR-CM'), Group('NFR-S'), Group('FR-CM-06'), Group('FR-CM-08'), Group('NFR-S-02')]
    public function test_instructor_uploads_a_powerpoint_and_learner_can_open_it(): void
    {
        $file = UploadedFile::fake()->create('lesson-1.pptx', 200, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

        $id = $this->actingAs($this->instructor)
            ->post($this->url(), ['type' => 'file', 'title' => 'Slides', 'file' => $file], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('resource.file_name', 'lesson-1.pptx')
            ->assertJsonMissingPath('resource.file_path')
            ->json('resource.id');

        $path = LessonResource::find($id)->file_path;
        Storage::disk('local')->assertExists($path);

        $this->actingAs($this->learner)
            ->getJson("/api/student/courses/{$this->class->id}")
            ->assertOk()
            ->assertJsonPath('course.resources.0.title', 'Slides');

        $this->actingAs($this->learner)->get("/api/student/resources/{$id}/file")->assertOk();
        $this->actingAs($this->outsider)->getJson("/api/student/resources/{$id}/file")->assertNotFound();

        $this->actingAs($this->instructor)->deleteJson("/api/instructor/resources/{$id}")->assertOk();
        Storage::disk('local')->assertMissing($path);
        $this->assertDatabaseMissing('lesson_resources', ['id' => $id]);
    }

    #[Group('FR-CM'), Group('NFR-S'), Group('FR-CM-06'), Group('NFR-S-02')]
    public function test_other_instructors_cannot_manage_the_class_resources(): void
    {
        $resource = LessonResource::create([
            'course_id' => $this->class->id, 'type' => 'link', 'title' => 'Site', 'url' => 'https://example.com',
        ]);

        $this->actingAs($this->otherInstructor)->getJson($this->url())->assertNotFound();
        $this->actingAs($this->otherInstructor)
            ->postJson($this->url(), ['type' => 'link', 'title' => 'X', 'url' => 'https://example.com'])
            ->assertNotFound();
        $this->actingAs($this->otherInstructor)->deleteJson("/api/instructor/resources/{$resource->id}")->assertNotFound();
        $this->assertDatabaseHas('lesson_resources', ['id' => $resource->id]);
    }

    #[Group('FR-CM'), Group('FR-CM-06')]
    public function test_disallowed_file_types_are_rejected(): void
    {
        $this->actingAs($this->instructor)
            ->post($this->url(), [
                'type' => 'file',
                'title' => 'Script',
                'file' => UploadedFile::fake()->create('run.exe', 10, 'application/octet-stream'),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');
    }
}
