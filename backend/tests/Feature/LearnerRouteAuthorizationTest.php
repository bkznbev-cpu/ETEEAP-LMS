<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Module;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('integration')]
class LearnerRouteAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    /** Every learner route, with a method and a sample URI. */
    private function learnerRoutes(int $courseId, int $moduleId): array
    {
        return [
            ['GET', '/api/student/courses'],
            ['GET', "/api/student/courses/{$courseId}"],
            ['GET', "/api/student/modules/{$moduleId}"],
            ['GET', "/api/student/modules/{$moduleId}/material"],
            ['POST', '/api/student/submissions'],
            ['GET', '/api/student/grades'],
            ['GET', '/api/student/notifications'],
            ['POST', '/api/student/notifications/read-all'],
            ['POST', '/api/student/notifications/1/read'],
            ['POST', '/api/student/setup-password'],
        ];
    }

    private function fixtures(): array
    {
        $instructor = User::factory()->create(['role' => 'instructor', 'school_id' => 'INS-R1', 'is_active' => true]);
        $course = Course::create([
            'name' => 'Route Course',
            'code' => 'RT-101',
            'instructor_id' => $instructor->id,
            'is_active' => true,
        ]);
        $module = Module::create([
            'course_id' => $course->id,
            'title' => 'Route Module',
            'is_published' => true,
        ]);

        return [$instructor, $course, $module];
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    public function test_other_roles_are_refused_on_every_learner_route(): void
    {
        [$instructor, $course, $module] = $this->fixtures();

        // An instructor enrolled in the course is still refused.
        $course->learners()->attach($instructor->id);

        $others = [
            $instructor,
            User::factory()->create(['role' => 'academic_admin', 'school_id' => 'ADM-R1', 'is_active' => true]),
            User::factory()->create(['role' => 'system_admin', 'school_id' => 'SYS-R1', 'is_active' => true]),
        ];

        foreach ($others as $user) {
            foreach ($this->learnerRoutes($course->id, $module->id) as [$method, $uri]) {
                $this->actingAs($user)
                    ->json($method, $uri)
                    ->assertForbidden()
                    ->assertJsonPath('message', 'Only learners can access this resource.');
            }
        }
    }

    #[Group('NFR-S'), Group('NFR-S-02')]
    public function test_learners_still_reach_their_routes(): void
    {
        [, $course, $module] = $this->fixtures();
        $learner = User::factory()->create(['role' => 'learner', 'school_id' => '24-R0001', 'is_active' => true]);
        $course->learners()->attach($learner->id);

        $this->actingAs($learner)->getJson('/api/student/courses')->assertOk()
            ->assertJsonCount(1, 'courses');
        $this->actingAs($learner)->getJson("/api/student/courses/{$course->id}")->assertOk();
        $this->actingAs($learner)->getJson("/api/student/modules/{$module->id}")->assertOk();
        $this->actingAs($learner)->getJson('/api/student/grades')->assertOk();
        $this->actingAs($learner)->getJson('/api/student/notifications')->assertOk();

        $this->actingAs($learner)
            ->post('/api/student/submissions', [
                'module_id' => $module->id,
                'file' => UploadedFile::fake()->create('work.pdf', 20, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertSuccessful();
    }
}
