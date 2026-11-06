<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ActivityGraded;
use App\Models\Grade;
use App\Models\Notification;
use App\Models\Progress;
use App\Models\Submission;
use App\Support\AdminNotifier;
use App\Support\ScoreCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class GradeController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Learner: View Grades
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $learner = $request->user();

        $grades = $learner->submissions()
            ->with([
                'module.course',
                'grade.instructor',
                'grade.items',
            ])
            ->whereHas('grade')
            ->latest('submitted_at')
            ->get()
            ->map(function ($submission) {

                $grade = $submission->grade;

                $percentage = null;

                if ($grade && $grade->max_score > 0) {
                    $percentage =
                        ($grade->score / $grade->max_score) * 100;
                }

                return [
                    'submission_id' => $submission->id,

                    'module' => [
                        'id' => $submission->module->id,
                        'name' => $submission->module->title,
                    ],

                    'course' => [
                        'id' => $submission->module->course->id,
                        'name' => $submission->module->course->name,
                        'code' => $submission->module->course->code,
                    ],

                    'file_name' => $submission->file_name,

                    'submitted_at' => $submission->submitted_at,

                    'score' => $grade->score,

                    'max_score' => $grade->max_score,

                    'percentage' => round($percentage, 2),

                    'feedback' => $grade->feedback,
                    // Scoring card rows (empty for a single score).
                    'items' => $grade->items->map->toCardArray()->values(),

                    'instructor' => $grade->instructor
                        ? $grade->instructor->name
                        : 'Instructor',

                    'graded_at' => $grade->graded_at,
                ];
            });

        return response()->json([
            'success' => true,
            'grades' => $grades,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | Instructor: Grade Submission
    |--------------------------------------------------------------------------
    */

    /** How long a password confirmation lets the instructor change saved scores. */
    private const EDIT_PASS_SECONDS = 600;

    /** Wrong passwords allowed per instructor in 15 minutes. */
    private const MAX_CONFIRM_ATTEMPTS = 5;

    private static function editPassKey(string $pass): string
    {
        return 'grade-edit-pass:' . hash('sha256', $pass);
    }

    /**
     * Scores already given are locked. To change them, the instructor
     * first confirms with their own password here and gets a one-time
     * pass for this submission (valid 10 minutes). The grade request
     * then sends it as "edit_pass".
     */
    public function confirmEdit(Request $request, $submissionId): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'max:255'],
        ], [
            'password.required' => 'Enter your password to confirm.',
        ]);

        $instructor = $request->user();

        if ($instructor->role !== 'instructor') {
            return response()->json(['success' => false, 'message' => 'Only instructors can grade submissions.'], 403);
        }

        $submission = Submission::with('module.course', 'learner', 'grade')->find($submissionId);

        if (!$submission) {
            return response()->json(['success' => false, 'message' => 'Submission not found.'], 404);
        }

        if ((int) $submission->module?->course?->instructor_id !== (int) $instructor->id) {
            return response()->json(['success' => false, 'message' => 'You are not assigned to this course.'], 403);
        }

        if (!$submission->grade) {
            return response()->json(['success' => false, 'message' => 'This submission has no saved score yet.'], 422);
        }

        $limitKey = 'grade-edit-confirm:' . $instructor->id;

        if (RateLimiter::tooManyAttempts($limitKey, self::MAX_CONFIRM_ATTEMPTS)) {
            $minutes = max(1, (int) ceil(RateLimiter::availableIn($limitKey) / 60));

            return response()->json([
                'success' => false,
                'message' => "Too many wrong passwords. Please try again in {$minutes} minute" . ($minutes === 1 ? '' : 's') . '.',
            ], 429);
        }

        $label = ($submission->learner?->name ?? 'a learner') . ' — ' . ($submission->module?->title ?? 'an activity');

        if (!Hash::check($validated['password'], $instructor->password)) {
            RateLimiter::hit($limitKey, 900);

            \App\Support\AuditLogger::log('grade_edit_refused', \App\Support\AuditLogger::GRADES, [
                'actor' => $instructor,
                'target' => $submission->grade,
                'target_label' => $label,
                'result' => 'failed',
                'details' => "Wrong password when confirming a score change for {$label}",
                'request' => $request,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Incorrect password. The saved scores were not unlocked.',
            ], 422);
        }

        RateLimiter::clear($limitKey);

        $pass = Str::random(48);

        Cache::put(self::editPassKey($pass), [
            'instructor_id' => $instructor->id,
            'submission_id' => $submission->id,
        ], self::EDIT_PASS_SECONDS);

        return response()->json([
            'success' => true,
            'message' => 'Password confirmed. You can now change the saved scores.',
            'edit_pass' => $pass,
            'expires_in' => self::EDIT_PASS_SECONDS,
        ]);
    }


    public function store(
        Request $request,
        $submissionId
    ): JsonResponse {

        /*
        |--------------------------------------------------------------------------
        | Scoring card or a single score
        |--------------------------------------------------------------------------
        |
        | A submission is one compiled file that can hold several activities.
        | With "items", each activity gets its own row (title, score, over)
        | and the grade stores the totals. Without "items", a single score
        | and maximum are accepted as before.
        |
        */

        $items = null;

        if ($request->has('items')) {
            $validated = $request->validate([
                'items' => ['required', 'array', 'min:1', 'max:30'],
                'items.*.title' => ['required', 'string', 'max:150'],
                'items.*.score' => ['required', 'numeric', 'min:0', 'max:100000'],
                'items.*.max_score' => ['required', 'numeric', 'gt:0', 'max:100000'],
                'feedback' => ['nullable', 'string', 'max:2000'],
            ], [
                'items.required' => 'Add at least one activity to the scoring card.',
                'items.max' => 'A scoring card can have up to 30 activities.',
                'items.*.title.required' => 'Every activity needs a title.',
                'items.*.score.required' => 'Every activity needs a score.',
                'items.*.max_score.required' => 'Every activity needs the total it is scored over.',
                'items.*.max_score.gt' => 'The total of an activity must be greater than zero.',
            ]);

            $items = collect(ScoreCalculator::normalizeItems($validated['items']));

            foreach ($items as $item) {
                if ($error = ScoreCalculator::itemError($item)) {
                    return response()->json([
                        'success' => false,
                        'message' => $error,
                    ], 422);
                }
            }

            $totals = ScoreCalculator::totals($items);
            $validated['score'] = $totals['score'];
            $validated['max_score'] = $totals['max_score'];
        } else {
            $validated = $request->validate([
                'score' => [
                    'required',
                    'numeric',
                    'min:0',
                ],

                'max_score' => [
                    'required',
                    'numeric',
                    'min:1',
                ],

                'feedback' => [
                    'nullable',
                    'string',
                    'max:2000',
                ],
            ]);
        }

        $instructor = $request->user();

        // One-time pass from confirmEdit(): lets saved scores be changed.
        $editPass = is_string($request->input('edit_pass')) ? $request->input('edit_pass') : '';
        $editPassData = $editPass !== '' ? Cache::get(self::editPassKey($editPass)) : null;


        /*
        |--------------------------------------------------------------------------
        | Check instructor role
        |--------------------------------------------------------------------------
        */

        if ($instructor->role !== 'instructor') {
            return response()->json([
                'success' => false,
                'message' => 'Only instructors can grade submissions.',
            ], 403);
        }


        /*
        |--------------------------------------------------------------------------
        | Find submission
        |--------------------------------------------------------------------------
        */

        $submission = Submission::with([
            'learner',
            'module.course'
        ])->find($submissionId);

        if (!$submission) {
            return response()->json([
                'success' => false,
                'message' => 'Submission not found.',
            ], 404);
        }


        /*
        |--------------------------------------------------------------------------
        | Check course instructor
        |--------------------------------------------------------------------------
        */

        if (
            !$submission->module ||
            !$submission->module->course ||
            $submission->module->course->instructor_id
                !== $instructor->id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'You are not assigned to this course.',
            ], 403);
        }


        /*
        |--------------------------------------------------------------------------
        | Check score
        |--------------------------------------------------------------------------
        */

        if ($validated['score'] > $validated['max_score']) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Score cannot be greater than the maximum score.',
            ], 422);
        }


        /*
        |--------------------------------------------------------------------------
        | Save grade and notification
        |--------------------------------------------------------------------------
        */

        $passIsValid = is_array($editPassData)
            && (int) ($editPassData['instructor_id'] ?? 0) === (int) $instructor->id
            && (int) ($editPassData['submission_id'] ?? 0) === (int) $submission->id;

        $result = DB::transaction(function () use (
            $validated,
            $submission,
            $instructor,
            $items,
            $passIsValid
        ) {

            /*
            |--------------------------------------------------------------------------
            | Check whether this submission already has a grade
            |--------------------------------------------------------------------------
            */

            // Lock the submission so a learner cannot unsubmit it while
            // it is being graded. Stop if it was unsubmitted just now.
            if (!Submission::whereKey($submission->id)->lockForUpdate()->exists()) {
                return null;
            }

            $existingGrade = Grade::where(
                'submission_id',
                $submission->id
            )->first();

            // Scores already given stay as they are; only new activities
            // can be added (the feedback can still change).
            // What the grade was, for the audit trail (old -> new).
            $before = $existingGrade ? [
                'score' => (float) $existingGrade->score,
                'max_score' => (float) $existingGrade->max_score,
                'feedback' => $existingGrade->feedback,
                'activities' => $existingGrade->items()->count(),
            ] : null;

            // Changing saved scores needs a password confirmation first.
            $savedScoresChanged = false;

            if ($existingGrade) {
                $lockError = self::lockedScoreError($existingGrade, $items, $validated);

                if ($lockError && !$passIsValid) {
                    return ['locked' => $lockError];
                }

                $savedScoresChanged = (bool) $lockError;
            }


            /*
            |--------------------------------------------------------------------------
            | Create or update grade
            |--------------------------------------------------------------------------
            */

            $grade = Grade::updateOrCreate(
                [
                    'submission_id' => $submission->id,
                ],
                [
                    'instructor_id' => $instructor->id,
                    'score' => $validated['score'],
                    'max_score' => $validated['max_score'],
                    'feedback' => $validated['feedback'] ?? null,
                    'graded_at' => now(),
                ]
            );

            /*
            | Replace the scoring card rows (a single score clears them).
            */
            $grade->items()->delete();

            if ($items) {
                $grade->items()->createMany($items->all());
            }


            /*
            |--------------------------------------------------------------------------
            | Mark submission as graded
            |--------------------------------------------------------------------------
            */

            $submission->update([
                'status' => 'graded',
            ]);


            /*
            |--------------------------------------------------------------------------
            | Mark the module as completed for this learner
            |--------------------------------------------------------------------------
            */

            $progress = Progress::firstOrNew([
                'learner_id' => $submission->learner_id,
                'module_id' => $submission->module_id,
            ]);

            $progress->status = 'completed';
            $progress->completion_percentage = 100;

            if (!$progress->started_at) {
                $progress->started_at = $submission->submitted_at ?? now();
            }

            $progress->completed_at = now();
            $progress->save();


            /*
            |--------------------------------------------------------------------------
            | Create notification only for a new grade
            |--------------------------------------------------------------------------
            */

            if (!$existingGrade) {

                Notification::create([
                    'user_id' => $submission->learner_id,

                    'title' => 'Activity Graded',

                    'message' =>
                        'Your activity "' .
                        $submission->module->title .
                        '" has been graded. Score: ' .
                        $validated['score'] .
                        '/' .
                        $validated['max_score'] .
                        '.',

                    'type' => 'grade',

                    'data' => [
                        'course_id' => $submission->module->course_id,
                        'module_id' => $submission->module_id,
                        'submission_id' => $submission->id,
                    ],

                    'is_read' => false,
                ]);

                AdminNotifier::submissionGraded(
                    $instructor,
                    $submission->learner,
                    $submission->module->title,
                    $submission->module->course->name,
                    $validated['score'],
                    $validated['max_score']
                );
            }


            $after = [
                'score' => (float) $grade->score,
                'max_score' => (float) $grade->max_score,
                'feedback' => $grade->feedback,
                'activities' => $grade->items()->count(),
            ];
            $learnerName = $submission->learner?->name ?? 'a learner';
            $moduleTitle = $submission->module?->title ?? 'an activity';

            if ($before) {
                [$old, $new] = \App\Support\AuditLogger::changes($before, $after);

                if ($new !== [] || $savedScoresChanged) {
                    \App\Support\AuditLogger::log('update', \App\Support\AuditLogger::GRADES, [
                        'actor' => $instructor,
                        'target' => $grade,
                        'target_label' => "{$learnerName} — {$moduleTitle}",
                        'old' => $old,
                        'new' => $new,
                        'details' => "Changed the grade of {$learnerName} for \"{$moduleTitle}\" from "
                            . "{$before['score']}/{$before['max_score']} to {$after['score']}/{$after['max_score']}"
                            . ($savedScoresChanged ? ' (saved scores edited after password confirmation)' : ''),
                    ]);
                }

                // Tell the learner when a score already given was changed.
                if (
                    $savedScoresChanged &&
                    ($before['score'] !== $after['score'] || $before['max_score'] !== $after['max_score'])
                ) {
                    Notification::create([
                        'user_id' => $submission->learner_id,
                        'title' => 'Grade Updated',
                        'message' => 'Your grade for "' . $submission->module->title . '" was updated from '
                            . $before['score'] . '/' . $before['max_score'] . ' to '
                            . $after['score'] . '/' . $after['max_score'] . '.',
                        'type' => 'grade',
                        'data' => [
                            'course_id' => $submission->module->course_id,
                            'module_id' => $submission->module_id,
                            'submission_id' => $submission->id,
                        ],
                        'is_read' => false,
                    ]);
                }
            } else {
                \App\Support\AuditLogger::log('create', \App\Support\AuditLogger::GRADES, [
                    'actor' => $instructor,
                    'target' => $grade,
                    'target_label' => "{$learnerName} — {$moduleTitle}",
                    'new' => $after,
                    'details' => "Graded {$learnerName} for \"{$moduleTitle}\": {$after['score']}/{$after['max_score']}",
                ]);
            }

            return [
                'used_edit_pass' => $savedScoresChanged,
                'grade' => $grade,
                'new_grade' => !$existingGrade,
                'submission' => $submission,
                // Email the learner for a new grade or a changed score.
                'email_learner' => !$existingGrade
                    || $before['score'] !== $after['score']
                    || $before['max_score'] !== $after['max_score'],
            ];
        });


        if (isset($result['locked'])) {
            return response()->json([
                'success' => false,
                'message' => $result['locked'],
                // The page then asks for the instructor's password.
                'password_required' => true,
            ], 422);
        }

        // The pass works once.
        if (!empty($result['used_edit_pass']) && $editPass !== '') {
            Cache::forget(self::editPassKey($editPass));
        }

        if ($result === null) {
            return response()->json([
                'success' => false,
                'message' => 'The learner unsubmitted this activity.',
            ], 404);
        }

        if ($result['email_learner']) {
            self::emailLearner($result['submission'], $result['grade'], $result['new_grade']);
        }

        return response()->json([
            'success' => true,

            'message' =>
                $result['new_grade']
                    ? 'Submission graded successfully.'
                    : 'Grade updated successfully.',

            'grade' => $result['grade']->load('items'),
        ]);
    }


    /**
     * A grade that was already given cannot be lowered or raised: every
     * saved activity row must come back unchanged and in the same order,
     * and new rows may only be added after them. A grade saved as a single
     * score counts as one locked row. Returns the message to show, or null.
     */
    private static function lockedScoreError(Grade $grade, ?Collection $items, array $validated): ?string
    {
        $message = 'Scores already given can\'t be changed. You can only add new activities.';
        $same = fn ($a, $b) => abs((float) $a - (float) $b) < 0.005;

        $locked = $grade->items()->get()->map(fn ($item) => [
            'title' => $item->title,
            'score' => $item->score,
            'max_score' => $item->max_score,
        ])->values();

        // Saved as a single score (no rows): that score is the locked row.
        if ($locked->isEmpty()) {
            $locked = collect([[
                'title' => null,
                'score' => $grade->score,
                'max_score' => $grade->max_score,
            ]]);
        }

        // A single score sent again must be the same score.
        if ($items === null) {
            return $locked->count() === 1
                && $same($validated['score'] ?? null, $locked[0]['score'])
                && $same($validated['max_score'] ?? null, $locked[0]['max_score'])
                ? null
                : $message;
        }

        if ($items->count() < $locked->count()) {
            return $message;
        }

        foreach ($locked as $index => $row) {
            $sent = $items[$index];

            if (
                !$same($sent['score'], $row['score']) ||
                !$same($sent['max_score'], $row['max_score']) ||
                ($row['title'] !== null && $sent['title'] !== $row['title'])
            ) {
                return $message;
            }
        }

        return null;
    }

    /**
     * Email the learner that their activity was graded (or the score
     * changed), when they have an email address. Sent after the
     * response; a mail problem is logged and never stops the grading.
     */
    private static function emailLearner(Submission $submission, Grade $grade, bool $isNewGrade): void
    {
        $learner = $submission->learner;

        if (!$learner || !$learner->is_active || trim((string) $learner->email) === '') {
            return;
        }

        $mail = new ActivityGraded($submission, $grade, $isNewGrade);

        app()->terminating(function () use ($learner, $mail, $submission) {
            try {
                Mail::to($learner->email)->send($mail);
            } catch (\Throwable $error) {
                Log::error('Grade email could not be sent.', [
                    'submission_id' => $submission->id,
                    'error' => $error->getMessage(),
                ]);
            }
        });
    }
}
