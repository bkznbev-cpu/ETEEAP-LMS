<?php

namespace App\Support;

use App\Models\Module;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * Finds the activities written in a module's material file, so the
 * scoring card can start with one row per activity.
 *
 * A line counts as an activity when it starts with a word such as
 * "Activity", "Exercise", "Task", "Quiz" or "Assessment" followed by a
 * number, e.g. "Activity 2: Reflection Paper (20 points)". The points,
 * when written on that line, become the activity's "over".
 *
 * Word (.docx) and PDF files are read; other files find nothing.
 */
class ActivityDetector
{
    /** The most rows a scoring card can have. */
    public const MAX_ACTIVITIES = 30;

    /** Files larger than this are not read (bytes). */
    private const MAX_FILE_SIZE = 30 * 1024 * 1024;

    private const HEADING = '/^\s*(activity|activities|act\.|exercise|task|assessment|quiz|assignment|laboratory|lab|worksheet|output)\s*(?:no\.?|number|#)?\s*(\d{1,3}|[ivxlc]{1,6})(?![\w])\s*[:.\-–—)]?\s*(.*)$/iu';

    private const POINTS = '/\(?\s*(\d{1,4})\s*(?:points?|pts?\.?|marks?)\s*\)?/iu';

    /**
     * @return list<array{title: string, max_score: int|null}>
     */
    public static function detect(Module $module): array
    {
        $path = str_replace('\\', '/', (string) $module->material_path);

        if (!Module::isStoredMaterialPath($path) || !Storage::disk('local')->exists($path)) {
            return [];
        }

        $disk = Storage::disk('local');
        $key = 'module-activities:' . $module->id . ':' . md5($path . '|' . $disk->lastModified($path));

        return Cache::remember($key, now()->addDay(), function () use ($disk, $path, $module) {
            try {
                if ($disk->size($path) > self::MAX_FILE_SIZE) {
                    return [];
                }

                $text = match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
                    'docx' => self::docxText($disk->path($path)),
                    'pdf' => self::pdfText($disk->path($path)),
                    default => '',
                };

                return self::fromText($text);
            } catch (\Throwable $error) {
                Log::warning('Activities could not be read from a module file.', [
                    'module_id' => $module->id,
                    'error' => $error->getMessage(),
                ]);

                return [];
            }
        });
    }

    /**
     * The activities found in plain text, one heading per line, in the
     * order they appear. A repeated heading (e.g. a table of contents
     * and the activity itself) is kept once, with the first points found.
     *
     * @return list<array{title: string, max_score: int|null}>
     */
    public static function fromText(string $text): array
    {
        $found = [];

        foreach (preg_split('/\R/u', $text) ?: [] as $line) {
            $line = trim(preg_replace('/\s+/u', ' ', $line) ?? '');

            if ($line === '' || mb_strlen($line) > 200 || !preg_match(self::HEADING, $line, $match)) {
                continue;
            }

            $word = mb_convert_case(rtrim($match[1], '.'), MB_CASE_TITLE);
            $word = $word === 'Act' ? 'Activity' : ($word === 'Activities' ? 'Activity' : $word);
            $number = ctype_digit($match[2]) ? (string) (int) $match[2] : strtoupper($match[2]);
            $key = mb_strtolower($word) . ' ' . $number;

            $rest = $match[3];
            $points = null;

            if (preg_match(self::POINTS, $rest, $pointsMatch)) {
                $points = (int) $pointsMatch[1];
                $rest = str_replace($pointsMatch[0], '', $rest);
            }

            // Table-of-contents page numbers ("Activity 1 ........ 12").
            $rest = trim(preg_replace('/[.\s]{3,}\d*\s*$/u', '', $rest) ?? '', " \t-–—:.");

            if (isset($found[$key])) {
                if ($rest !== '' && !str_contains($found[$key]['title'], ':')) {
                    $found[$key]['title'] = mb_substr("{$word} {$number}: {$rest}", 0, 150);
                }

                if ($found[$key]['max_score'] === null && $points) {
                    $found[$key]['max_score'] = $points;
                }

                continue;
            }

            $title = "{$word} {$number}" . ($rest !== '' ? ": {$rest}" : '');

            $found[$key] = [
                'title' => mb_substr($title, 0, 150),
                'max_score' => $points > 0 ? $points : null,
            ];

            if (count($found) >= self::MAX_ACTIVITIES) {
                break;
            }
        }

        return array_values($found);
    }

    /** The paragraphs of a Word file, one per line. */
    private static function docxText(string $file): string
    {
        $zip = new ZipArchive();

        if ($zip->open($file) !== true) {
            return '';
        }

        $xml = $zip->getFromName('word/document.xml');
        $zip->close();

        if (!is_string($xml) || $xml === '') {
            return '';
        }

        // Paragraphs and line breaks become new lines; tabs become spaces.
        $xml = preg_replace(['/<\/w:p>/', '/<w:br[^>]*\/>/', '/<w:tab[^>]*\/>/'], ["\n", "\n", ' '], $xml) ?? '';

        return html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    /** The text of a PDF file (needs smalot/pdfparser). */
    private static function pdfText(string $file): string
    {
        if (!class_exists(\Smalot\PdfParser\Parser::class)) {
            return '';
        }

        return (new \Smalot\PdfParser\Parser())->parseFile($file)->getText();
    }
}
