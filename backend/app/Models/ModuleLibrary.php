<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The shared Module Library. There is only ever one row.
 */
class ModuleLibrary extends Model
{
    protected $table = 'module_library';

    protected $fillable = [
        'data',
        'revision',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'revision' => 'integer',
        ];
    }

    public static function current(): ?self
    {
        return static::query()->orderBy('id')->first();
    }

    /**
     * Ids (library keys) of the library Modules that belong to one Course
     * of one Program, matched by code the same way the Class page does
     * (trimmed, case-insensitive). Empty when nothing matches.
     *
     * Library shape: {programs: [{code, courses: [{id, code}],
     * modules: [{id, courseId}]}]}; lists may also be keyed objects.
     *
     * @return list<string>
     */
    public function moduleKeysForCourse(?string $programCode, ?string $courseCode): array
    {
        $normal = fn ($value) => strtoupper(trim((string) $value));
        $program = $normal($programCode);
        $course = $normal($courseCode);

        if ($program === '' || $course === '') {
            return [];
        }

        $data = json_decode((string) $this->data, true);
        $list = fn ($value) => is_array($value) ? array_values(array_filter($value, 'is_array')) : [];
        $keys = [];

        foreach ($list($data['programs'] ?? null) as $entry) {
            if ($normal($entry['code'] ?? '') !== $program) {
                continue;
            }

            $courseIds = [];
            foreach ($list($entry['courses'] ?? null) as $libraryCourse) {
                if ($normal($libraryCourse['code'] ?? '') === $course) {
                    $courseIds[] = trim((string) ($libraryCourse['id'] ?? ''));
                }
            }

            foreach ($list($entry['modules'] ?? null) as $module) {
                $id = trim((string) ($module['id'] ?? ''));
                if ($id !== '' && in_array(trim((string) ($module['courseId'] ?? '')), $courseIds, true)) {
                    $keys[] = $id;
                }
            }
        }

        return array_values(array_unique($keys));
    }
}
