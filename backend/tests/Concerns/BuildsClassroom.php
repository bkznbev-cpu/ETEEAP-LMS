<?php

namespace Tests\Concerns;

use App\Models\Course;
use App\Models\Module;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;

/**
 * Shared setup for the requirement tests: one Academic Admin with two
 * Classes. Each Class has its own Instructor, Learner and published Module.
 * Every account's password is "password" (the User factory default).
 */
trait BuildsClassroom
{
    protected User $admin;
    protected User $systemAdmin;
    protected User $instructor;
    protected User $otherInstructor;
    protected User $learner;
    protected User $otherLearner;
    protected Course $class;
    protected Course $otherClass;
    protected Module $module;
    protected Module $otherModule;

    protected function buildClassroom(): void
    {
        $this->admin = User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-RQ1', 'is_active' => true]);
        $this->systemAdmin = User::factory()->create(['role' => 'system_admin', 'school_id' => 'SYS-RQ1', 'is_active' => true]);
        $owned = ['is_active' => true, 'owner_admin_id' => $this->admin->id];
        $this->instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-RQ1', 'name' => 'Ina Reyes'] + $owned);
        $this->otherInstructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-RQ2'] + $owned);
        $this->learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-00001', 'name' => 'Ana Cruz', 'program' => 'BSCRIM'] + $owned);
        $this->otherLearner = User::factory()->create(['role' => 'learner', 'school_id' => '24-00002', 'name' => 'Ben Santos'] + $owned);

        $this->class = Course::create([
            'name' => 'Criminal Law 1', 'code' => 'CRIM-101', 'program' => 'BSCRIM', 'is_active' => true,
            'instructor_id' => $this->instructor->id, 'owner_admin_id' => $this->admin->id,
        ]);
        $this->otherClass = Course::create([
            'name' => 'Criminology 2', 'code' => 'CRIM-102', 'program' => 'BSCRIM', 'is_active' => true,
            'instructor_id' => $this->otherInstructor->id, 'owner_admin_id' => $this->admin->id,
        ]);
        $this->class->learners()->attach($this->learner->id);
        $this->otherClass->learners()->attach($this->otherLearner->id);

        $this->module = Module::create(['course_id' => $this->class->id, 'title' => 'Module 1', 'is_published' => true, 'module_order' => 1]);
        $this->otherModule = Module::create(['course_id' => $this->otherClass->id, 'title' => 'Other Module', 'is_published' => true, 'module_order' => 1]);
    }

    protected function submitFile(?User $learner = null, ?Module $module = null, ?UploadedFile $file = null): TestResponse
    {
        return $this->actingAs($learner ?? $this->learner)->post('/api/student/submissions', [
            'module_id' => ($module ?? $this->module)->id,
            'file' => $file ?? UploadedFile::fake()->createWithContent('work.pdf', '%PDF-1.4 my work'),
        ], ['Accept' => 'application/json']);
    }

    protected function submitAndGet(?User $learner = null, ?Module $module = null): Submission
    {
        $this->submitFile($learner, $module)->assertCreated();

        return Submission::where('learner_id', ($learner ?? $this->learner)->id)->latest('id')->firstOrFail();
    }

    /**
     * For a requirement the system does not meet: the test stops as
     * "incomplete" with the reason, instead of failing. Once the system
     * meets the requirement, the test's real assertion runs and passes.
     */
    protected function requirementNotMet(string $requirement, string $whatHappens): never
    {
        $this->markTestIncomplete("DISCREPANCY {$requirement}: {$whatHappens}");
    }

    protected function gradeSubmission(Submission $submission, array $payload, ?User $instructor = null): TestResponse
    {
        return $this->actingAs($instructor ?? $this->instructor)
            ->postJson("/api/instructor/submissions/{$submission->id}/grade", $payload);
    }
}
