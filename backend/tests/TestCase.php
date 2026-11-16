<?php

namespace Tests;

use App\Models\Course;
use App\Models\ModuleLibrary;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Saves a Module Library with one Course (under the Class's Program)
     * holding these module keys, and gives the Class that Course, so the
     * keys can be assigned to it (FR-CM-04). Returns the course code.
     */
    protected function libraryCourseFor(Course $class, array $moduleKeys, string $courseCode = 'COURSE-1'): string
    {
        $program = $class->program ?: 'PROG';
        $class->update(['program' => $program, 'subject_code' => $courseCode]);

        $library = json_decode((string) ModuleLibrary::current()?->data, true) ?: ['programs' => []];
        $library['programs'][] = [
            'code' => $program,
            'name' => $program,
            'courses' => [['id' => "course-{$program}-{$courseCode}", 'code' => $courseCode, 'name' => $courseCode]],
            'modules' => array_map(fn ($key) => [
                'id' => $key, 'courseId' => "course-{$program}-{$courseCode}", 'title' => $key,
            ], $moduleKeys),
        ];

        $row = ModuleLibrary::current();
        $row
            ? $row->update(['data' => json_encode($library), 'revision' => $row->revision + 1])
            : ModuleLibrary::create(['data' => json_encode($library), 'revision' => 1]);

        return $courseCode;
    }
}
