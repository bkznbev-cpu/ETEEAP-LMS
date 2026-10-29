<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Profile photos for every role.
 *
 * Any size of photo is accepted (phone cameras make 3-12 MB pictures).
 * It is shrunk to at most 800 pixels on its longest side, turned the
 * right way up (phone photos record their rotation separately), and saved
 * as a compact JPEG: a profile picture is shown small, so this keeps it
 * sharp while using a fraction of the space.
 */
class ProfilePhoto
{
    /** Validation rules: an image of any size the server accepts (25 MB). */
    public const RULES = ['image', 'mimes:jpeg,png,webp', 'max:25600'];

    public const MESSAGES = [
        'image' => 'Choose a photo (JPG, PNG or WEBP).',
        'mimes' => 'Choose a photo (JPG, PNG or WEBP).',
        'max' => 'The photo must be 25 MB or smaller.',
    ];

    private const MAX_SIDE = 800;

    private const QUALITY = 85;

    /** Memory the resize may use; raised to this for large photos. */
    private const MEMORY = 512 * 1024 * 1024;

    /** Validation messages for a field, e.g. messagesFor('photo'). */
    public static function messagesFor(string $field): array
    {
        $messages = [];
        foreach (self::MESSAGES as $rule => $text) {
            $messages["{$field}.{$rule}"] = $text;
        }

        return $messages;
    }

    /** Saves the photo on the public disk and returns its path. */
    public static function store(UploadedFile $file): string
    {
        $jpeg = self::smallJpeg($file);

        // Without the image library, or for a picture too large to open,
        // keep the file as uploaded: it was already checked to be an image.
        if ($jpeg === null) {
            return $file->store('profile-photos', 'public');
        }

        $path = 'profile-photos/' . Str::random(40) . '.jpg';
        Storage::disk('public')->put($path, $jpeg);

        return $path;
    }

    private static function smallJpeg(UploadedFile $file): ?string
    {
        if (! function_exists('imagecreatefromstring')) {
            return null;
        }

        $source = $file->getRealPath();
        $size = @getimagesize($source);
        if (! $size || $size[0] < 1 || $size[1] < 1) {
            return null;
        }
        [$width, $height] = $size;

        // Opening a picture takes about 5 bytes per pixel. Make room, or
        // give up on resizing (a 50-megapixel photo) rather than crash.
        $needed = (int) ($width * $height * 5 + 32 * 1024 * 1024);
        if (! self::haveMemory($needed)) {
            return null;
        }

        $original = @imagecreatefromstring((string) @file_get_contents($source));
        if (! $original) {
            return null;
        }

        // One step: scale down onto a white canvas (JPEG has no
        // transparency, so transparent PNG/WEBP areas become white).
        $scale = min(1, self::MAX_SIDE / max($width, $height));
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));

        $small = imagecreatetruecolor($newWidth, $newHeight);
        imagefill($small, 0, 0, imagecolorallocate($small, 255, 255, 255));
        imagealphablending($small, true);
        imagecopyresampled($small, $original, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($original);

        $small = self::upright($small, $file);

        ob_start();
        imagejpeg($small, null, self::QUALITY);
        $jpeg = (string) ob_get_clean();
        imagedestroy($small);

        return $jpeg === '' ? null : $jpeg;
    }

    private static function haveMemory(int $needed): bool
    {
        $limit = self::bytes((string) ini_get('memory_limit'));
        if ($limit < 0) {
            return true; // no limit
        }

        $free = $limit - memory_get_usage(true);
        if ($free >= $needed) {
            return true;
        }

        $wanted = memory_get_usage(true) + $needed;
        if ($wanted > self::MEMORY || $limit >= self::MEMORY) {
            return false;
        }

        return @ini_set('memory_limit', (string) self::MEMORY) !== false;
    }

    private static function bytes(string $value): int
    {
        $value = trim($value);
        if ($value === '' || $value === '-1') {
            return -1;
        }

        $number = (int) $value;

        return match (strtolower(substr($value, -1))) {
            'g' => $number * 1024 * 1024 * 1024,
            'm' => $number * 1024 * 1024,
            'k' => $number * 1024,
            default => $number,
        };
    }

    /** Phone photos store "rotate me" in EXIF instead of rotating the pixels. */
    private static function upright(\GdImage $image, UploadedFile $file): \GdImage
    {
        if (! function_exists('exif_read_data') || $file->getMimeType() !== 'image/jpeg') {
            return $image;
        }

        $exif = @exif_read_data($file->getRealPath());
        $angle = match ((int) ($exif['Orientation'] ?? 1)) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        if ($angle === 0) {
            return $image;
        }

        $rotated = imagerotate($image, $angle, 0);
        if (! $rotated) {
            return $image;
        }
        imagedestroy($image);

        return $rotated;
    }
}
