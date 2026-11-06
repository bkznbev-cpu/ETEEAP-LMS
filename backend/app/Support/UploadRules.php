<?php

namespace App\Support;

/**
 * File rules for uploads, kept in one place so they can be unit tested.
 * Sizes are in kilobytes, as Laravel's "max" rule expects for files.
 */
class UploadRules
{
    // Learner submissions: PDF, Word, Excel or a photo of the work, up to 10 MB.
    public const SUBMISSION_TYPES = 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png,webp';
    public const SUBMISSION_MAX_KB = 10240;

    // Module Library materials: PDF, an image, Word or Excel, up to 25 MB.
    public const MODULE_TYPES = 'pdf,jpg,jpeg,png,webp,doc,docx,xls,xlsx';
    public const MODULE_MAX_KB = 25600;

    public static function submissionFile(): array
    {
        return ['required', 'file', 'mimes:' . self::SUBMISSION_TYPES, 'max:' . self::SUBMISSION_MAX_KB];
    }

    public static function moduleFile(): array
    {
        return ['required', 'file', 'max:' . self::MODULE_MAX_KB, 'mimes:' . self::MODULE_TYPES];
    }
}
