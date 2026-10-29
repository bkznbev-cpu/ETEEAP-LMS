<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\Notification;
use App\Models\Progress;
use App\Models\Submission;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class SubmissionController extends Controller
{
    public function store(
        Request $request
    ): JsonResponse {

        $validated = $request->validate([

            'module_id' => [
                'required',
                'integer',
                'exists:modules,id'
            ],

            'file' => [
                'required',
                'file',
                // PDF, Word, Excel or a photo of the work.
                'mimes:pdf,doc,docx,xls,xlsx,jpg,jpeg,png,webp',
                'max:10240'
            ],

            'comment' => [
                'nullable',
                'string',
                'max:2000'
            ],

        ]);


        /*
         * Get the currently logged-in learner.
         */

        $learner = $request->user();


        /*
         * Only learners can submit activities.
         */

        if ($learner->role !== 'learner') {

            return response()->json([

                'success' => false,

                'message' =>
                    'Only learners can submit activities.',

            ], 403);

        }


        /*
         * Find the module and its course.
         * Also load the course instructor.
         */

        // Only published modules accept work (drafts are hidden from learners).
        $module = Module::with([
            'course',
            'course.instructor'
        ])
            ->where('is_published', true)
            ->find(
                $validated['module_id']
            );


        /*
         * Make sure the module exists.
         */

        if (!$module) {

            return response()->json([

                'success' => false,

                'message' =>
                    'Module not found.',

            ], 404);

        }


        /*
         * Check whether the learner
         * is enrolled in the course.
         */

        // Enrolled in the module's class, and the class is still active.
        $enrolled = ModuleController::findForLearner(
            $learner,
            $module->id
        ) !== null;


        if (!$enrolled) {

            return response()->json([

                'success' => false,

                'message' =>
                    'You are not enrolled in this course.',

            ], 403);

        }


        /*
         * Prevent duplicate submissions.
         */

        $existingSubmission = Submission::where(
            'module_id',
            $module->id
        )
        ->where(
            'learner_id',
            $learner->id
        )
        ->first();


        if ($existingSubmission) {

            return response()->json([

                'success' => false,

                'message' =>
                    'You have already submitted this activity.',

                'submission_id' =>
                    $existingSubmission->id,

            ], 409);

        }


        /*
         * Store the uploaded file.
         */

        $path = $request
            ->file('file')
            ->store(
                'submissions/' .
                $learner->school_id,
                'local'
            );


        /*
         * Create the submission.
         */

        $submission = Submission::create([

            'module_id' =>
                $module->id,

            'learner_id' =>
                $learner->id,

            'file_path' =>
                $path,

            'file_name' =>
                $request
                    ->file('file')
                    ->getClientOriginalName(),

            'comment' =>
                $validated['comment'] ?? null,

            'submitted_at' =>
                now(),

            'status' =>
                'submitted',

        ]);


        /*
         * Record progress: the module is now in progress for this learner.
         */

        Progress::updateOrCreate(
            [
                'learner_id' => $learner->id,
                'module_id' => $module->id,
            ],
            [
                'status' => 'in_progress',
                'completion_percentage' => 50,
                'started_at' => now(),
                'completed_at' => null,
            ]
        );


        /*
         * =====================================================
         * CREATE INSTRUCTOR NOTIFICATION
         * =====================================================
         */

        $instructor =
            $module->course->instructor;


        /*
         * Only create the notification if
         * the course has an assigned instructor.
         */

        if ($instructor) {

            Notification::create([

                'user_id' =>
                    $instructor->id,

                'title' =>
                    'New Submission',

                'message' =>
                    $learner->name .
                    ' submitted "' .
                    $module->title .
                    '" for ' .
                    $module->course->name .
                    '.',

                'type' =>
                    'submission',

                // Opens this learner in the class (instructor portal).
                'data' => [
                    'course_id' => $module->course_id,
                    'learner_id' => $learner->id,
                    'module_id' => $module->id,
                    'submission_id' => $submission->id,
                ],

                'is_read' =>
                    false,

            ]);

        }


        AuditLogger::log('submit', AuditLogger::SUBMISSIONS, [
            'actor' => $learner,
            'target' => $submission,
            'target_label' => "{$learner->name} — {$module->title}",
            'new' => [
                'module' => $module->title,
                'class' => $module->course->code ?: $module->course->name,
                'file_name' => $submission->file_name,
            ],
            'details' => "Submitted \"{$module->title}\" for {$module->course->name}",
        ]);

        /*
         * Return successful response.
         */

        return response()->json([

            'success' => true,

            'message' =>
                'Activity submitted successfully.',

            'submission' => [

                'id' =>
                    $submission->id,

                'module_id' =>
                    $submission->module_id,

                // The stored location stays private.
                'file_name' =>
                    $submission->file_name,

                'comment' =>
                    $submission->comment,

                'submitted_at' =>
                    $submission->submitted_at,

                'status' =>
                    $submission->status,

            ],

        ], 201);
    }


    /**
     * Unsubmit: the learner takes back their own work so they can submit
     * again. Only allowed while the instructor has not graded it.
     */
    public function destroy(Request $request, $submissionId): JsonResponse
    {
        $learner = $request->user();

        $result = DB::transaction(function () use ($learner, $submissionId) {
            // Lock the row so the instructor cannot grade it at the same moment.
            $submission = Submission::with('module.course.instructor')
                ->where('learner_id', $learner->id)
                ->whereKey($submissionId)
                ->lockForUpdate()
                ->first();

            if (!$submission) {
                return ['status' => 404, 'message' => 'Submission not found.'];
            }

            if ($submission->grade()->exists()) {
                return ['status' => 409, 'message' => 'This activity has already been graded and can no longer be unsubmitted.'];
            }

            $path = $submission->file_path;
            $module = $submission->module;

            $submission->delete();

            AuditLogger::log('unsubmit', AuditLogger::SUBMISSIONS, [
                'actor' => $learner,
                'target' => $submission,
                'target_label' => "{$learner->name} — " . ($module?->title ?? 'an activity'),
                'old' => [
                    'module' => $module?->title,
                    'file_name' => $submission->file_name,
                    'submitted_at' => (string) $submission->submitted_at,
                ],
                'details' => 'Unsubmitted "' . ($module?->title ?? 'an activity') . '" (the file was removed)',
            ]);

            // The module goes back to "not started" for this learner.
            Progress::where('learner_id', $learner->id)
                ->where('module_id', $submission->module_id)
                ->update([
                    'status' => 'not_started',
                    'completion_percentage' => 0,
                    'started_at' => null,
                    'completed_at' => null,
                ]);

            $instructor = $module?->course?->instructor;

            if ($instructor) {
                Notification::create([
                    'user_id' => $instructor->id,
                    'title' => 'Submission Withdrawn',
                    'message' => $learner->name . ' unsubmitted "' . $module->title . '" for ' . $module->course->name . '.',
                    'type' => 'submission',
                    'data' => [
                        'course_id' => $module->course_id,
                        'learner_id' => $learner->id,
                        'module_id' => $module->id,
                    ],
                    'is_read' => false,
                ]);
            }

            return ['status' => 200, 'path' => $path, 'module_id' => $submission->module_id];
        });

        if ($result['status'] !== 200) {
            return response()->json([
                'success' => false,
                'message' => $result['message'],
            ], $result['status']);
        }

        // Remove the file only after the record is gone.
        if ($result['path']) {
            Storage::disk('local')->delete($result['path']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Your work was unsubmitted. You can submit again.',
            'module_id' => $result['module_id'],
        ]);
    }
}
