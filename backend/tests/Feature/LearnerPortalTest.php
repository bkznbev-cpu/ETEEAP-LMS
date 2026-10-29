<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Module;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Every endpoint the learner pages (student/*.html) call.
 */
class LearnerPortalTest extends TestCase
{
    use RefreshDatabase;

    private User $instructor;
    private User $learner;
    private User $otherLearner;
    private Course $class;
    private Module $module;
    private Module $draft;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-LP', 'is_active' => true]);
        $this->instructor = User::factory()->create([
            'role' => 'instructor', 'school_id' => 'INS-LP', 'name' => 'Prof Reyes',
            'email' => 'reyes@x.edu', 'contact' => '0917', 'is_active' => true,
        ]);
        $this->learner = User::factory()->create([
            'role' => 'learner', 'school_id' => '24-LP001', 'name' => 'Ana Cruz',
            'email' => 'ana@x.edu', 'program' => 'BSIT', 'is_active' => true,
        ]);
        $this->otherLearner = User::factory()->create(['role' => 'learner', 'school_id' => '24-LP002', 'is_active' => true]);

        $this->class = Course::create([
            'name' => 'Web Development', 'code' => 'WEB-101', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $admin->id,
        ]);
        $this->class->learners()->attach($this->learner->id);

        $this->module = Module::create(['course_id' => $this->class->id, 'title' => 'HTML Basics', 'is_published' => true, 'module_order' => 1]);
        $this->draft = Module::create(['course_id' => $this->class->id, 'title' => 'Draft', 'is_published' => false, 'module_order' => 2]);
    }

    private function submit(?Module $module = null)
    {
        return $this->actingAs($this->learner)->post('/api/student/submissions', [
            'module_id' => ($module ?? $this->module)->id,
            'file' => UploadedFile::fake()->createWithContent('work.pdf', '%PDF-1.4 my work'),
        ], ['Accept' => 'application/json']);
    }

    public function test_learner_can_submit_pdf_word_excel_or_a_photo(): void
    {
        $modules = [];
        foreach (['work.pdf', 'work.docx', 'work.doc', 'sheet.xlsx', 'sheet.xls', 'photo.jpg', 'photo.png'] as $i => $name) {
            $module = Module::create(['course_id' => $this->class->id, 'title' => "Activity $i", 'is_published' => true, 'module_order' => 10 + $i]);
            $this->actingAs($this->learner)->post('/api/student/submissions', [
                'module_id' => $module->id,
                'file' => UploadedFile::fake()->createWithContent($name, 'content'),
            ], ['Accept' => 'application/json'])->assertCreated();
        }

        foreach (['slides.pptx', 'archive.zip', 'page.html'] as $name) {
            $this->actingAs($this->learner)->post('/api/student/submissions', [
                'module_id' => $this->module->id,
                'file' => UploadedFile::fake()->createWithContent($name, 'content'),
            ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('file');
        }
    }

    public function test_class_list_shows_counts_and_only_the_instructor_name(): void
    {
        $this->submit()->assertCreated();

        $response = $this->actingAs($this->learner)->getJson('/api/student/courses')
            ->assertOk()
            ->assertJsonCount(1, 'courses')
            ->assertJsonPath('courses.0.instructor.name', 'Prof Reyes')
            ->assertJsonPath('courses.0.module_count', 1)
            ->assertJsonPath('courses.0.submitted_count', 1)
            ->assertJsonPath('courses.0.graded_count', 0);

        $this->assertArrayNotHasKey('email', $response->json('courses.0.instructor'));
        $this->assertStringNotContainsString('reyes@x.edu', $response->getContent());
    }

    public function test_inactive_classes_are_hidden(): void
    {
        $this->class->update(['is_active' => false]);

        $this->actingAs($this->learner)->getJson('/api/student/courses')->assertOk()->assertJsonCount(0, 'courses');
        $this->actingAs($this->learner)->getJson("/api/student/courses/{$this->class->id}")->assertNotFound();
        $this->actingAs($this->learner)->getJson("/api/student/modules/{$this->module->id}")->assertNotFound();
    }

    public function test_class_page_shows_published_modules_with_my_status_and_grade(): void
    {
        $submissionId = $this->submit()->json('submission.id');

        $this->actingAs($this->learner)->getJson("/api/student/courses/{$this->class->id}")
            ->assertOk()
            ->assertJsonCount(1, 'course.modules')
            ->assertJsonPath('course.modules.0.title', 'HTML Basics')
            ->assertJsonPath('course.modules.0.my_submission.status', 'submitted');

        $this->actingAs($this->instructor)
            ->postJson("/api/instructor/submissions/{$submissionId}/grade", ['score' => 45, 'max_score' => 50, 'feedback' => 'Good'])
            ->assertSuccessful();

        $this->actingAs($this->learner)->getJson("/api/student/modules/{$this->module->id}")
            ->assertOk()
            ->assertJsonPath('module.course.name', 'Web Development')
            ->assertJsonPath('module.my_submission.status', 'graded')
            ->assertJsonPath('module.my_submission.grade.percentage', 90)
            ->assertJsonPath('module.my_submission.grade.feedback', 'Good');

        $this->actingAs($this->learner)->getJson('/api/student/grades')->assertOk()->assertJsonCount(1, 'grades');
    }

    public function test_drafts_and_other_classes_cannot_be_opened_or_submitted(): void
    {
        $this->actingAs($this->learner)->getJson("/api/student/modules/{$this->draft->id}")->assertNotFound();
        $this->submit($this->draft)->assertNotFound();

        $this->actingAs($this->otherLearner)->getJson("/api/student/modules/{$this->module->id}")->assertNotFound();
        $this->actingAs($this->otherLearner)->post('/api/student/submissions', [
            'module_id' => $this->module->id,
            'file' => UploadedFile::fake()->createWithContent('x.pdf', '%PDF-1.4'),
        ], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_submitting_twice_is_refused_and_the_path_stays_private(): void
    {
        $first = $this->submit()->assertCreated();
        $this->assertArrayNotHasKey('file_path', $first->json('submission'));

        $this->submit()->assertStatus(409);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->instructor->id, 'type' => 'submission']);
    }

    public function test_learner_opens_only_their_own_submitted_file(): void
    {
        $id = $this->submit()->json('submission.id');

        $view = $this->actingAs($this->learner)->get("/api/student/submissions/{$id}/file?disposition=inline");
        $view->assertOk();
        $this->assertStringStartsWith('inline', $view->headers->get('Content-Disposition'));

        $download = $this->actingAs($this->learner)->get("/api/student/submissions/{$id}/file");
        $download->assertOk();
        $this->assertStringContainsString('work.pdf', $download->headers->get('Content-Disposition'));

        $this->actingAs($this->otherLearner)->getJson("/api/student/submissions/{$id}/file")->assertNotFound();
        $this->actingAs($this->instructor)->getJson("/api/student/submissions/{$id}/file")->assertForbidden();
    }

    public function test_profile_show_and_update(): void
    {
        $this->actingAs($this->learner)->getJson('/api/student/profile')
            ->assertOk()
            ->assertJsonPath('user.school_id', '24-LP001')
            ->assertJsonPath('user.class_count', 1);

        $email = $this->learner->email;

        // The current email may be sent back unchanged with the contact.
        $this->actingAs($this->learner)
            ->putJson('/api/student/profile', ['email' => $email, 'contact' => '0917 123 4567', 'name' => 'Hacker'])
            ->assertOk()
            ->assertJsonPath('user.email', $email)
            ->assertJsonPath('user.contact', '0917 123 4567')
            ->assertJsonPath('user.name', 'Ana Cruz'); // name is managed by the admin

        // A different (or cleared) email is refused here: it needs the verified "Change Email" steps.
        $this->actingAs($this->learner)->putJson('/api/student/profile', ['email' => 'ana.cruz@x.edu'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->actingAs($this->learner)->putJson('/api/student/profile', ['email' => '', 'contact' => ''])
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->assertSame($email, $this->learner->fresh()->email);

        $this->actingAs($this->learner)->putJson('/api/student/profile', ['contact' => '<script>'])
            ->assertStatus(422)->assertJsonValidationErrors('contact');
    }

    public function test_profile_photo_upload_replaces_the_old_one(): void
    {
        Storage::fake('public');

        $first = $this->actingAs($this->learner)->post('/api/student/profile/photo', [
            'photo' => UploadedFile::fake()->image('me.jpg', 200, 200),
        ], ['Accept' => 'application/json'])->assertOk();

        $oldPath = $this->learner->fresh()->profile_photo_path;
        Storage::disk('public')->assertExists($oldPath);
        $this->assertNotNull($first->json('user.profile_photo_url'));

        $this->actingAs($this->learner)->post('/api/student/profile/photo', [
            'photo' => UploadedFile::fake()->image('new.png', 200, 200),
        ], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertMissing($oldPath);

        // Not an image: refused.
        $this->actingAs($this->learner)->post('/api/student/profile/photo', [
            'photo' => UploadedFile::fake()->createWithContent('x.pdf', '%PDF-1.4'),
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_notifications_list_and_mark_read(): void
    {
        $note = Notification::create(['user_id' => $this->learner->id, 'title' => 'Hi', 'message' => 'x', 'type' => 'announcement', 'is_read' => false]);
        Notification::create(['user_id' => $this->otherLearner->id, 'title' => 'Not mine', 'message' => 'x', 'type' => 'grade', 'is_read' => false]);

        $this->actingAs($this->learner)->getJson('/api/student/notifications')->assertOk()->assertJsonCount(1, 'notifications');
        $this->actingAs($this->learner)->postJson("/api/student/notifications/{$note->id}/read")->assertOk();
        $this->assertTrue($note->fresh()->is_read);
        $this->actingAs($this->learner)->postJson('/api/student/notifications/read-all')->assertOk();
    }

    public function test_other_roles_cannot_use_learner_endpoints(): void
    {
        foreach (['/api/student/courses', '/api/student/profile', '/api/student/grades', '/api/student/notifications'] as $url) {
            $this->actingAs($this->instructor)->getJson($url)->assertForbidden();
        }
    }
}
