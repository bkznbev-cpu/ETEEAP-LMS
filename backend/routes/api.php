<?php

use Illuminate\Support\Facades\Route;

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsurePasswordSetupComplete;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureSystemAdmin;

use App\Http\Controllers\Api\AnnouncementReplyController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PasswordController;
use App\Http\Controllers\Api\PasswordResetController;

use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\StudentProfileController;
use App\Http\Controllers\Api\ModuleController;
use App\Http\Controllers\Api\SubmissionController;
use App\Http\Controllers\Api\GradeController;
use App\Http\Controllers\Api\NotificationController;

use App\Http\Controllers\Api\InstructorController;
use App\Http\Controllers\Api\InstructorAnnouncementController;
use App\Http\Controllers\Api\InstructorDashboardController;
use App\Http\Controllers\Api\InstructorCourseController;
use App\Http\Controllers\Api\InstructorModuleController;
use App\Http\Controllers\Api\InstructorNotificationController;
use App\Http\Controllers\Api\InstructorProfileController;
use App\Http\Controllers\Api\LessonResourceController;

use App\Http\Controllers\Api\AcademicAdminController;
use App\Http\Controllers\Api\SystemAdminController;
use App\Http\Controllers\Api\SystemAdminProfileController;
use App\Http\Controllers\Api\SystemAdminAcademicAdminController;
use App\Http\Controllers\Api\SystemAdminBackupController;
use App\Http\Controllers\Api\SystemAdminAuditLogController;

/*
|--------------------------------------------------------------------------
| Siknayan LMS API
|--------------------------------------------------------------------------
|
| One login endpoint serves every role. The response tells the frontend
| which portal to open (learner, instructor, academic_admin, system_admin).
|
*/

// Login (all roles)
Route::post('/login', [AuthController::class, 'login']);

// Forgot password (all roles): email a 5-digit code, check it, then set
// a new password. Limited per address to stop abuse.
Route::post('/password/forgot', [PasswordResetController::class, 'forgot'])->middleware('throttle:5,1');
Route::post('/password/verify-code', [PasswordResetController::class, 'verifyCode'])->middleware('throttle:10,1');
Route::post('/password/reset', [PasswordResetController::class, 'reset'])->middleware('throttle:10,1');


/*
|--------------------------------------------------------------------------
| Protected routes (valid token + active account)
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth:sanctum',
    EnsureAccountIsActive::class,
    EnsurePasswordSetupComplete::class,
])->group(function () {

    // Revokes the current token (all roles)
    Route::post('/logout', [AuthController::class, 'logout']);

    // Add your own email (the step after setting a new password): a code
    // is sent to it, and the email is saved only after the code is entered.
    Route::post('/account/email', [\App\Http\Controllers\Api\AccountEmailController::class, 'store'])->middleware('throttle:10,1');
    Route::post('/account/email/verify', [\App\Http\Controllers\Api\AccountEmailController::class, 'verify'])->middleware('throttle:10,1');
    Route::post('/account/email/resend', [\App\Http\Controllers\Api\AccountEmailController::class, 'resend'])->middleware('throttle:5,1');

    // Change your own email (all roles): current password + a code sent
    // to the new address. The email changes only after verification.
    Route::get('/account/email-change', [\App\Http\Controllers\Api\EmailChangeController::class, 'show']);
    Route::post('/account/email-change', [\App\Http\Controllers\Api\EmailChangeController::class, 'store'])->middleware('throttle:10,1');
    Route::post('/account/email-change/verify', [\App\Http\Controllers\Api\EmailChangeController::class, 'verify'])->middleware('throttle:10,1');
    Route::post('/account/email-change/resend', [\App\Http\Controllers\Api\EmailChangeController::class, 'resend'])->middleware('throttle:5,1');
    Route::delete('/account/email-change', [\App\Http\Controllers\Api\EmailChangeController::class, 'destroy']);

    // Change your own password (all roles; needs the current password)
    Route::put('/account/password', [PasswordController::class, 'changeOwnPassword']);


    /*
    |--------------------------------------------------------------------------
    | System Administrator
    |--------------------------------------------------------------------------
    */

    Route::prefix('system-admin')
        ->middleware(EnsureSystemAdmin::class)
        ->group(function () {

            Route::get('/session', static fn () => response()->json([
                'success' => true,
            ]));

            Route::get('/dashboard', [SystemAdminController::class, 'dashboard']);
            // Audit Logs: read only (no update or delete route, for any role)
            Route::get('/audit-logs', [SystemAdminAuditLogController::class, 'index']);
            Route::get('/audit-logs/export', [SystemAdminAuditLogController::class, 'export'])->middleware('throttle:10,1');

            // Own profile (POST so the form can include a photo file)
            Route::get('/profile', [SystemAdminProfileController::class, 'show']);
            Route::post('/profile', [SystemAdminProfileController::class, 'update']);

            // Notifications (same handlers as the Academic Admin's; own records only)
            Route::get('/notifications', [NotificationController::class, 'adminIndex']);
            Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
            Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
            Route::patch('/notifications/{id}/unread', [NotificationController::class, 'markUnread']);
            Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

            Route::get('/academic-administrators', [SystemAdminAcademicAdminController::class, 'index']);
            Route::post('/academic-administrators', [SystemAdminAcademicAdminController::class, 'store']);
            Route::put('/academic-administrators/{id}', [SystemAdminAcademicAdminController::class, 'update']);
            Route::delete('/academic-administrators/{id}', [SystemAdminAcademicAdminController::class, 'destroy']);
            Route::post('/academic-administrators/{id}/reset-password', [SystemAdminAcademicAdminController::class, 'resetPassword']);

            // Data Backup: database + uploaded files in one zip
            Route::get('/backups', [SystemAdminBackupController::class, 'index']);
            Route::post('/backups', [SystemAdminBackupController::class, 'store'])->middleware('throttle:5,10');
            Route::get('/backups/{name}/download', [SystemAdminBackupController::class, 'download'])
                ->where('name', 'siknayan-backup-[0-9]{8}-[0-9]{6}\.zip');
            Route::delete('/backups/{name}', [SystemAdminBackupController::class, 'destroy'])
                ->where('name', 'siknayan-backup-[0-9]{8}-[0-9]{6}\.zip');
            // Restore (replaces all data; password + typing RESTORE) and upload a backup zip
            Route::post('/backups/upload', [SystemAdminBackupController::class, 'upload'])->middleware('throttle:5,10');
            Route::post('/backups/{name}/restore', [SystemAdminBackupController::class, 'restore'])
                ->where('name', 'siknayan-backup-[0-9]{8}-[0-9]{6}\.zip')
                ->middleware('throttle:5,10');
        });


    /*
    |--------------------------------------------------------------------------
    | Learner
    |--------------------------------------------------------------------------
    */

    // Every /student route is for learners only (checked here once, on top
    // of any checks inside the controllers).
    Route::middleware(EnsureRole::class . ':learner')->group(function () {
        Route::post('/student/setup-password', [PasswordController::class, 'setup']);

        Route::get('/student/courses', [StudentController::class, 'courses']);
        Route::get('/student/courses/{courseId}', [StudentController::class, 'course']);

        Route::get('/student/modules/{moduleId}', [ModuleController::class, 'show']);
        Route::get('/student/modules/{moduleId}/material', [ModuleController::class, 'material']);
        Route::get('/student/resources/{resourceId}/file', [LessonResourceController::class, 'studentFile']);

        Route::post('/student/submissions', [SubmissionController::class, 'store']);
        Route::delete('/student/submissions/{submissionId}', [SubmissionController::class, 'destroy']);
        Route::get('/student/submissions/{submissionId}/file', [ModuleController::class, 'submissionFile']);

        // Own profile (email and contact; password via /account/password)
        Route::get('/student/profile', [StudentProfileController::class, 'show']);
        Route::put('/student/profile', [StudentProfileController::class, 'update']);

        // Replies to class announcements
        Route::post('/student/announcements/{announcementId}/replies', [AnnouncementReplyController::class, 'studentStore'])->middleware('throttle:20,1');
        Route::delete('/student/announcement-replies/{replyId}', [AnnouncementReplyController::class, 'studentDestroy']);
        Route::post('/student/profile/photo', [StudentProfileController::class, 'uploadPhoto']);

        Route::get('/student/grades', [GradeController::class, 'index']);

        Route::get('/student/notifications', [NotificationController::class, 'index']);
        Route::post('/student/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::post('/student/notifications/{notificationId}/read', [NotificationController::class, 'markAsRead']);
    });


    /*
    |--------------------------------------------------------------------------
    | Instructor
    |--------------------------------------------------------------------------
    */

    // Every /instructor route is for instructors only (checked here once,
    // on top of any checks inside the controllers).
    Route::middleware(EnsureRole::class . ':instructor')->group(function () {
        Route::post('/instructor/setup-password', [PasswordController::class, 'setupInstructor']);

        Route::get('/instructor/dashboard', [InstructorDashboardController::class, 'index']);

        // Classes and their modules
        Route::get('/instructor/classes', [InstructorCourseController::class, 'index']);
        Route::get('/instructor/classes/{courseId}', [InstructorCourseController::class, 'show']);
        Route::post('/instructor/classes/{courseId}/modules', [InstructorModuleController::class, 'store']);
        Route::put('/instructor/modules/{moduleId}', [InstructorModuleController::class, 'update']);
        Route::get('/instructor/modules/{moduleId}/material', [InstructorModuleController::class, 'material']);

        // Lesson resources: links, PPT, videos and other files for a class
        Route::get('/instructor/classes/{courseId}/resources', [LessonResourceController::class, 'index']);
        Route::post('/instructor/classes/{courseId}/resources', [LessonResourceController::class, 'store']);
        Route::get('/instructor/resources/{resourceId}/file', [LessonResourceController::class, 'instructorFile']);
        Route::delete('/instructor/resources/{resourceId}', [LessonResourceController::class, 'destroy']);

        // Class announcements
        Route::get('/instructor/classes/{courseId}/announcements', [InstructorAnnouncementController::class, 'index']);
        Route::post('/instructor/classes/{courseId}/announcements', [InstructorAnnouncementController::class, 'store']);
        Route::put('/instructor/announcements/{announcementId}', [InstructorAnnouncementController::class, 'update']);
        Route::delete('/instructor/announcements/{announcementId}', [InstructorAnnouncementController::class, 'destroy']);
        Route::post('/instructor/announcements/{announcementId}/replies', [AnnouncementReplyController::class, 'instructorStore']);
        Route::delete('/instructor/announcement-replies/{replyId}', [AnnouncementReplyController::class, 'instructorDestroy']);

        // Submissions and grading
        Route::get('/instructor/submissions', [InstructorController::class, 'submissions']);
        Route::get('/instructor/submissions/{submissionId}/file', [InstructorController::class, 'file']);
        Route::post('/instructor/submissions/{submissionId}/grade', [GradeController::class, 'store']);
        // Password check before changing scores already given.
        Route::post('/instructor/submissions/{submissionId}/grade/confirm-edit', [GradeController::class, 'confirmEdit']);

        // Notifications
        Route::get('/instructor/notifications', [InstructorNotificationController::class, 'index']);
        Route::post('/instructor/notifications/read-all', [InstructorNotificationController::class, 'markAllAsRead']);
        Route::post('/instructor/notifications/{notificationId}/read', [InstructorNotificationController::class, 'markAsRead']);

        // Profile
        Route::get('/instructor/profile', [InstructorProfileController::class, 'show']);
        Route::put('/instructor/profile', [InstructorProfileController::class, 'update']);
        Route::post('/instructor/profile/password', [InstructorProfileController::class, 'changePassword']);
        Route::post('/instructor/profile/photo', [InstructorProfileController::class, 'uploadPhoto']);
    });


    /*
    |--------------------------------------------------------------------------
    | Academic Administrator (the proposal's "Administrator")
    |--------------------------------------------------------------------------
    */

    Route::prefix('admin')->group(function () {

        Route::post('/setup-password', [PasswordController::class, 'setupAcademicAdmin']);
        Route::put('/change-password', [PasswordController::class, 'changePassword']);

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'adminIndex']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::patch('/notifications/{id}/unread', [NotificationController::class, 'markUnread']);
        Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

        // Dashboard and reports
        Route::get('/dashboard', [AcademicAdminController::class, 'dashboard']);
        Route::get('/reports', [AcademicAdminController::class, 'reports']);

        // Profile
        Route::get('/profile', [AcademicAdminController::class, 'profile']);
        Route::put('/profile', [AcademicAdminController::class, 'updateProfile']);
        Route::post('/profile/photo', [AcademicAdminController::class, 'uploadProfilePhoto']);

        // Learners
        Route::get('/learners', [AcademicAdminController::class, 'learners']);
        Route::post('/learners', [AcademicAdminController::class, 'storeLearner']);
        Route::post('/learners/import', [AcademicAdminController::class, 'importLearners']);
        Route::put('/learners/{id}', [AcademicAdminController::class, 'updateLearner']);
        Route::delete('/learners/{id}', [AcademicAdminController::class, 'destroyLearner']);

        // Instructors
        Route::get('/instructors', [AcademicAdminController::class, 'instructors']);
        Route::post('/instructors', [AcademicAdminController::class, 'storeInstructor']);
        Route::post('/instructors/import', [AcademicAdminController::class, 'importInstructors']);
        Route::put('/instructors/{id}', [AcademicAdminController::class, 'updateInstructor']);
        Route::delete('/instructors/{id}', [AcademicAdminController::class, 'destroyInstructor']);

        // Classes
        Route::get('/classes', [AcademicAdminController::class, 'classes']);
        Route::post('/classes', [AcademicAdminController::class, 'storeClass']);
        Route::put('/classes/{id}', [AcademicAdminController::class, 'updateClass']);
        Route::delete('/classes/{id}', [AcademicAdminController::class, 'destroyClass']);

        // Class enrollment
        Route::get('/classes/{id}/learners', [AcademicAdminController::class, 'classLearners']);
        Route::post('/classes/{id}/learners', [AcademicAdminController::class, 'enrollLearner']);
        Route::delete('/classes/{id}/learners/{learnerId}', [AcademicAdminController::class, 'removeLearner']);

        // Class modules and module files
        Route::get('/classes/{id}/modules', [AcademicAdminController::class, 'classModules']);
        Route::post('/classes/{id}/modules', [AcademicAdminController::class, 'storeModule']);
        Route::put('/classes/{id}/modules/sync', [AcademicAdminController::class, 'syncClassModules']);
        Route::put('/module-library/{libraryKey}/material', [AcademicAdminController::class, 'replaceLibraryMaterial']);
        Route::post('/module-files', [AcademicAdminController::class, 'uploadModuleFile']);
        Route::get('/module-files', [AcademicAdminController::class, 'showModuleFile']);
    });
});
