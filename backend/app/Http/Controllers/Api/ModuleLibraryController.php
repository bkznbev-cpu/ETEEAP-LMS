<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ModuleLibrary;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The Module Library shared by every Academic Admin.
 *
 * The library page sends the whole library (as JSON text, stored exactly
 * as sent) on each save, together with the revision it started from. If someone else saved in the meantime the
 * save is refused (409) and the latest library is sent back instead.
 */
class ModuleLibraryController extends Controller
{
    // A library far bigger than any real one; stops runaway uploads.
    private const MAX_BYTES = 5 * 1024 * 1024;

    public function show(Request $request): JsonResponse
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $library = ModuleLibrary::current();

        return response()->json([
            'success' => true,
            'library' => $library?->data,
            'revision' => $library?->revision ?? 0,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        if ($response = $this->checkAdmin($request)) {
            return $response;
        }

        $validated = $request->validate([
            'library' => ['required', 'string', 'max:' . self::MAX_BYTES],
            'revision' => ['present', 'nullable', 'integer', 'min:0'],
        ]);

        $decoded = json_decode($validated['library'], true);

        if (!is_array($decoded) || !array_key_exists('programs', $decoded) || !is_array($decoded['programs'])) {
            return response()->json([
                'success' => false,
                'message' => 'The Module Library data is not valid.',
            ], 422);
        }

        $baseRevision = (int) ($validated['revision'] ?? 0);

        $result = DB::transaction(function () use ($request, $validated, $baseRevision) {
            $library = ModuleLibrary::query()->orderBy('id')->lockForUpdate()->first();
            $currentRevision = $library?->revision ?? 0;

            if ($baseRevision !== $currentRevision) {
                return ['conflict' => true, 'library' => $library];
            }

            if ($library) {
                $library->update([
                    'data' => $validated['library'],
                    'revision' => $currentRevision + 1,
                    'updated_by' => $request->user()->id,
                ]);
            } else {
                $library = ModuleLibrary::create([
                    'data' => $validated['library'],
                    'revision' => 1,
                    'updated_by' => $request->user()->id,
                ]);
            }

            return ['conflict' => false, 'library' => $library, 'first' => $currentRevision === 0];
        });

        /** @var ModuleLibrary|null $library */
        $library = $result['library'];

        if ($result['conflict']) {
            return response()->json([
                'success' => false,
                'conflict' => true,
                'message' => 'Another Academic Admin changed the Module Library. The latest version has been loaded.',
                'library' => $library?->data,
                'revision' => $library?->revision ?? 0,
            ], 409);
        }

        AuditLogger::log($result['first'] ? 'create' : 'update', AuditLogger::MODULES, [
            'target_type' => 'module_library',
            'target_id' => 'module-library',
            'new' => [
                'programs' => count($decoded['programs']),
                'revision' => $library->revision,
            ],
            'details' => $result['first']
                ? 'Saved the Module Library to the database for the first time'
                : 'Updated the Module Library',
            'request' => $request,
        ]);

        return response()->json([
            'success' => true,
            'revision' => $library->revision,
        ]);
    }

    private function checkAdmin(Request $request): ?JsonResponse
    {
        if ($request->user()?->role !== 'academic_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Only Academic Administrators can access this resource.',
            ], 403);
        }

        return null;
    }
}
