<?php

namespace Tests\Unit;

use App\Models\Course;
use App\Models\Grade;
use App\Models\Module;
use App\Models\Submission;
use App\Models\User;
use App\Support\AuditLogger;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Group;

#[Group('unit')]
class AuditLoggerTest extends TestCase
{
    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_label_returns_known_and_fallback_action_labels(): void
    {
        $this->assertSame('Sign-in', AuditLogger::label('sign_in'));
        $this->assertSame('Custom action', AuditLogger::label('custom_action'));
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_changes_reports_modified_and_added_fields_but_omits_removed_fields(): void
    {
        $changes = AuditLogger::changes(
            ['name' => 'Old name', 'removed' => 'value'],
            ['name' => 'New name', 'added' => 'value'],
        );

        $this->assertSame(
            [['name' => 'Old name', 'added' => null], ['name' => 'New name', 'added' => 'value']],
            $changes,
        );
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_changes_preserves_false_and_null_values(): void
    {
        $changes = AuditLogger::changes(
            ['enabled' => true, 'status' => 'active'],
            ['enabled' => false, 'status' => null],
        );

        $this->assertSame(
            [['enabled' => true, 'status' => 'active'], ['enabled' => false, 'status' => null]],
            $changes,
        );
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_target_maps_supported_models_to_audit_metadata(): void
    {
        $user = new User(['school_id' => 'SYS-001', 'name' => 'System Admin']);
        $user->setAttribute('id', 1);

        $grade = new Grade;
        $grade->setAttribute('id', 142);

        $course = new Course(['code' => 'IT 101', 'name' => 'Intro to IT']);
        $course->setAttribute('id', 10);

        $module = new Module(['title' => 'HTML Basics']);
        $module->setAttribute('id', 20);

        $submission = new Submission(['file_name' => 'homework.pdf']);
        $submission->setAttribute('id', 30);

        $this->assertSame(['user', 'SYS-001', 'System Admin'], AuditLogger::target(['target' => $user]));
        $this->assertSame(['grade', '#142', null], AuditLogger::target(['target' => $grade]));
        $this->assertSame(['class', 'IT 101', 'Intro to IT'], AuditLogger::target(['target' => $course]));
        $this->assertSame(['module', '#20', 'HTML Basics'], AuditLogger::target(['target' => $module]));
        $this->assertSame(['submission', '#30', 'homework.pdf'], AuditLogger::target(['target' => $submission]));
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_target_uses_model_id_when_user_or_course_identifiers_are_empty(): void
    {
        $user = new User(['name' => 'Unassigned User']);
        $user->setAttribute('id', 7);

        $course = new Course(['name' => 'Uncoded Class']);
        $course->setAttribute('id', 8);

        $this->assertSame(['user', '#7', 'Unassigned User'], AuditLogger::target(['target' => $user]));
        $this->assertSame(['class', '#8', 'Uncoded Class'], AuditLogger::target(['target' => $course]));
    }

    #[Group('FR-SA'), Group('FR-SA-03')]
    public function test_target_metadata_can_be_supplied_without_a_model_or_override_model_defaults(): void
    {
        $course = new Course(['code' => 'IT 101', 'name' => 'Intro to IT']);

        $this->assertSame(
            ['custom_class', 'CUSTOM-1', 'Custom label'],
            AuditLogger::target([
                'target' => $course,
                'target_type' => 'custom_class',
                'target_id' => 'CUSTOM-1',
                'target_label' => 'Custom label',
            ]),
        );
        $this->assertSame(
            ['user', 'SYS-002', 'Custom admin'],
            AuditLogger::target([
                'target_type' => 'user',
                'target_id' => 'SYS-002',
                'target_label' => 'Custom admin',
            ]),
        );
    }
}
