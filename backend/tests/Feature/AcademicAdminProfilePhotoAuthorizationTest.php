<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class AcademicAdminProfilePhotoAuthorizationTest extends TestCase
{
    public function test_learner_cannot_upload_an_academic_admin_profile_photo(): void
    {
        $learner = new User();
        $learner->role = 'learner';
        $learner->is_active = true;
        $learner->password_setup_complete = true;
        $learner->email = "learner@example.com";
        $learner->email_verified_at = now();

        $this->actingAs($learner, 'sanctum')
            ->postJson('/api/admin/profile/photo')
            ->assertForbidden()
            ->assertJsonPath('success', false)
            ->assertJsonPath(
                'message',
                'Only Academic Administrators can access this resource.'
            );
    }

    public function test_instructor_cannot_upload_an_academic_admin_profile_photo(): void
    {
        $instructor = new User();
        $instructor->role = 'instructor';
        $instructor->is_active = true;
        $instructor->password_setup_complete = true;
        $instructor->email = "instructor@example.com";
        $instructor->email_verified_at = now();

        $this->actingAs($instructor, 'sanctum')
            ->postJson('/api/admin/profile/photo')
            ->assertForbidden()
            ->assertJsonPath('success', false)
            ->assertJsonPath(
                'message',
                'Only Academic Administrators can access this resource.'
            );
    }
}
