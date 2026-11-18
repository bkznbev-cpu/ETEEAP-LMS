<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Module;
use App\Support\ActivityDetector;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InstructorModuleController extends Controller
{
    /**
     * View or download a module's file. Only for modules in the
     * instructor's own active classes (published or not).
     */
    public function material(Request $request, int $moduleId)
    {
        $module = Module::where('id', $moduleId)
            ->whereHas('course', function ($query) use ($request) {
                $query->where('instructor_id', $request->user()->id)
                    ->where('is_active', true);
            })
            ->first();

        if (!$module) {
            return response()->json([
                'success' => false,
                'message' => 'Module not found.',
            ], 404);
        }

        return ModuleController::sendMaterial($request, $module);
    }

    /**
     * The activities a scoring card for this module starts with: the
     * module's saved activity list, or, before any card is saved, the
     * activities found in the module's file.
     */
    public function activities(Request $request, int $moduleId): JsonResponse
    {
        $module = Module::withTrashed()
            ->where('id', $moduleId)
            ->whereHas('course', fn ($query) => $query->where('instructor_id', $request->user()->id))
            ->first();

        if (!$module) {
            return response()->json([
                'success' => false,
                'message' => 'Module not found.',
            ], 404);
        }

        $saved = $module->activities()->get(['title', 'description', 'max_score']);

        if ($saved->isNotEmpty()) {
            return response()->json([
                'success' => true,
                // Found in the file at assignment and no Over set yet.
                'source' => $saved->every(fn ($activity) => $activity->max_score === null) ? 'detected' : 'saved',
                'activities' => $saved->map(fn ($activity) => [
                    'title' => $activity->title,
                    'description' => $activity->description,
                    'max_score' => $activity->max_score,
                ])->values(),
            ]);
        }

        // Modules assigned before detection ran at assignment.
        $detected = ActivityDetector::detect($module);

        return response()->json([
            'success' => true,
            'source' => $detected === [] ? 'none' : 'detected',
            'activities' => $detected,
        ]);
    }

    public function store(
        Request $request,
        int $courseId
    ): JsonResponse {
        $instructor = $request->user();

        $course = Course::where(
            'instructor_id',
            $instructor->id
        )
        ->where('is_active', true)
        ->findOrFail($courseId);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_published' => ['sometimes', 'boolean'],
        ]);

        $nextOrder = (
            $course->modules()->max('module_order') ?? 0
        ) + 1;

        $module = $course->modules()->create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'module_order' => $nextOrder,
            'is_published' => $validated['is_published'] ?? false,
        ]);

        AuditLogger::log('create', AuditLogger::MODULES, [
            'target' => $module,
            'new' => ['class' => $course->code, 'title' => $module->title, 'is_published' => (bool) $module->is_published],
            'details' => "Added module \"{$module->title}\" to {$course->code}",
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Module created successfully.',
            'module' => $module,
        ], 201);
    }

    public function update(
        Request $request,
        int $moduleId
    ): JsonResponse {
        $instructor = $request->user();

        $module = Module::whereHas(
            'course',
            function ($query) use ($instructor) {
                $query->where(
                    'instructor_id',
                    $instructor->id
                );
            }
        )->findOrFail($moduleId);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'module_order' => ['sometimes', 'integer', 'min:1'],
            'is_published' => ['sometimes', 'boolean'],
        ]);

        $before = $module->only(['title', 'description', 'module_order', 'is_published']);
        $module->update($validated);
        [$old, $new] = AuditLogger::changes($before, $module->only(array_keys($before)));

        if ($new !== []) {
            AuditLogger::log('update', AuditLogger::MODULES, [
                'target' => $module,
                'old' => $old,
                'new' => $new,
                'details' => "Updated module \"{$module->title}\": " . implode(', ', array_map(fn ($f) => str_replace('_', ' ', $f), array_keys($new))),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Module updated successfully.',
            'module' => $module->fresh(),
        ]);
    }
}
