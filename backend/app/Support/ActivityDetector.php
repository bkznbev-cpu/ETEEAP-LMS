<?php

namespace App\Support;

use App\Models\Grade;
use App\Models\Module;
use App\Models\ModuleActivity;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * Finds the activities written in a module's material file, so the
 * scoring card can start with one row per activity.
 *
 * A line counts as an activity heading when it starts with a word such
 * as "Activity", "Exercise", "Task", "Quiz" or "Assessment" followed by
 * a number, e.g. "Activity 2 – Variables and Data Types". The name after
 * the number is the activity's title (or the next short line when the
 * heading has no name), and the lines under it, up to the next heading,
 * are its description.
 *
 * No maximum score is ever taken from the file: the instructor sets the
 * Over of every activity.
 *
 * Word (.docx) and PDF files are read; other files find nothing.
 */
class ActivityDetector
{
    /** The most rows a scoring card can have. */
    public const MAX_ACTIVITIES = 30;

    /** Files larger than this are not read (bytes). */
    private const MAX_FILE_SIZE = 30 * 1024 * 1024;

    /** Longest description kept for an activity (characters). */
    private const MAX_DESCRIPTION = 500;

    private const HEADING = '/^\s*(activity|activities|act\.|exercise|task|assessment|quiz|assignment|laboratory|lab|worksheet|output)\s*(?:no\.?|number|#)?\s*(\d{1,3}|[ivxlc]{1,6})(?![\w])\s*[:.\-–—)]?\s*(.*)$/iu';

    /**
     * @return list<array{title: string, description: string|null, max_score: null}>
     */
    public static function detect(Module $module): array
    {
        $path = str_replace('\\', '/', (string) $module->material_path);

        if (!Module::isStoredMaterialPath($path) || !Storage::disk('local')->exists($path)) {
            return [];
        }

        $disk = Storage::disk('local');
        $key = 'module-activities:v2:' . $module->id . ':' . md5($path . '|' . $disk->lastModified($path));

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
     * Run when a module is assigned to a class or gets a new file: the
     * activities found in the file become the module's activity list
     * (with no Over), so every learner's scoring card starts with them.
     *
     * A list the instructor has worked on is kept: once an Over is set
     * or a learner of the module is graded, a new file changes nothing.
     * Never throws; a file that cannot be read leaves the list as it is.
     */
    public static function assignToModule(Module $module): void
    {
        try {
            $saved = ModuleActivity::where('module_id', $module->id);

            if ((clone $saved)->exists()) {
                $instructorWorkedOnIt = (clone $saved)->whereNotNull('max_score')->exists()
                    || Grade::whereHas('submission', fn ($query) => $query->where('module_id', $module->id))->exists();

                if ($instructorWorkedOnIt) {
                    return;
                }
            }

            $found = self::detect($module);

            DB::transaction(function () use ($module, $found) {
                ModuleActivity::where('module_id', $module->id)->delete();

                foreach ($found as $position => $activity) {
                    ModuleActivity::create([
                        'module_id' => $module->id,
                        'title' => $activity['title'],
                        'description' => $activity['description'],
                        'max_score' => null,
                        'position' => $position,
                    ]);
                }
            });
        } catch (\Throwable $error) {
            Log::warning('The activities of a module could not be saved.', [
                'module_id' => $module->id,
                'error' => $error->getMessage(),
            ]);
        }
    }

    /**
     * The activities found in plain text, in the order they appear. A
     * repeated heading (e.g. a table of contents and the activity itself)
     * is kept once; its later name and description win, since the
     * activity itself comes after the table of contents.
     *
     * @return list<array{title: string, description: string|null, max_score: null}>
     */
    public static function fromText(string $text): array
    {
        $lines = [];

        foreach (preg_split('/\R/u', $text) ?: [] as $line) {
            $line = trim(preg_replace('/\s+/u', ' ', $line) ?? '');

            if ($line !== '') {
                $lines[] = $line;
            }
        }

        $found = [];
        $count = count($lines);

        for ($i = 0; $i < $count; $i++) {
            $heading = self::heading($lines[$i]);

            if ($heading === null) {
                continue;
            }

            [$key, $label, $name] = $heading;
            $next = $i + 1;

            // "Activity 1" alone on a line: the next short line is its name.
            if (
                $name === ''
                && $next < $count
                && self::heading($lines[$next]) === null
                && mb_strlen($lines[$next]) <= 80
                && !preg_match('/[.?!:;,]$/u', $lines[$next])
            ) {
                $name = self::withoutPageNumber($lines[$next]);
                $next++;
            }

            // The lines under the heading, up to the next heading.
            $description = '';

            for ($j = $next; $j < $count && self::heading($lines[$j]) === null; $j++) {
                $description = trim($description . ' ' . $lines[$j]);

                if (mb_strlen($description) >= self::MAX_DESCRIPTION) {
                    break;
                }
            }

            $description = $description === ''
                ? null
                : rtrim(mb_substr($description, 0, self::MAX_DESCRIPTION));

            if (isset($found[$key])) {
                if ($name !== '') {
                    $found[$key]['title'] = mb_substr($name, 0, 150);
                }

                if ($description !== null) {
                    $found[$key]['description'] = $description;
                }

                continue;
            }

            if (count($found) >= self::MAX_ACTIVITIES) {
                continue;
            }

            $found[$key] = [
                'title' => mb_substr($name !== '' ? $name : $label, 0, 150),
                'description' => $description,
                'max_score' => null,
            ];
        }

        return array_values($found);
    }

    /**
     * For a heading line: [key, label, name], e.g. ["activity 2",
     * "Activity 2", "Variables and Data Types"]. Null for other lines.
     *
     * @return array{0: string, 1: string, 2: string}|null
     */
    private static function heading(string $line): ?array
    {
        if (mb_strlen($line) > 200 || !preg_match(self::HEADING, $line, $match)) {
            return null;
        }

        $word = mb_convert_case(rtrim($match[1], '.'), MB_CASE_TITLE);
        $word = in_array($word, ['Act', 'Activities'], true) ? 'Activity' : $word;
        $number = ctype_digit($match[2]) ? (string) (int) $match[2] : strtoupper($match[2]);

        return [
            mb_strtolower($word) . ' ' . $number,
            "{$word} {$number}",
            self::withoutPageNumber($match[3]),
        ];
    }

    /** Drops a table-of-contents leader and page number ("Intro ..... 12"). */
    private static function withoutPageNumber(string $text): string
    {
        return trim(preg_replace('/(?:\s*\.{3,}\s*|\s{2,})\d*\s*$/u', '', $text) ?? '', " \t-–—:.");
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
