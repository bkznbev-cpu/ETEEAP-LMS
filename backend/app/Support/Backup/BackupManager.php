<?php

namespace App\Support\Backup;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use ZipArchive;

/**
 * Creates, lists and deletes Siknayan backups.
 *
 * A backup is one zip in config('backup.directory'):
 *   database.sql   all tables (temporary ones without rows)
 *   files/...      uploaded files (submissions, module materials, photos)
 *   RESTORE.txt    how to restore it
 *   manifest.json  what is inside
 * The .env settings file is never included. With a password, every entry
 * is AES-256 encrypted; the password is not stored anywhere.
 */
class BackupManager
{
    /** File names the server creates; anything else is refused. */
    public const NAME_PATTERN = '/^siknayan-backup-\d{8}-\d{6}\.zip$/';

    public function __construct(
        private DatabaseDumper $dumper,
        private DatabaseImporter $importer
    ) {
    }

    public function directory(): string
    {
        $directory = config('backup.directory');
        File::ensureDirectoryExists($directory, 0700);

        return $directory;
    }

    public function isValidName(string $name): bool
    {
        return (bool) preg_match(self::NAME_PATTERN, $name);
    }

    public function path(string $name): ?string
    {
        if (!$this->isValidName($name)) {
            return null;
        }

        $path = $this->directory() . DIRECTORY_SEPARATOR . $name;

        return is_file($path) ? $path : null;
    }

    /** Saved backups, newest first. */
    public function list(): array
    {
        $items = [];

        foreach (glob($this->directory() . DIRECTORY_SEPARATOR . 'siknayan-backup-*.zip') ?: [] as $path) {
            $name = basename($path);

            if (!$this->isValidName($name)) {
                continue;
            }

            $meta = json_decode((string) @file_get_contents($path . '.json'), true) ?: [];

            $items[] = [
                'name' => $name,
                'size' => filesize($path),
                'created_at' => $meta['created_at'] ?? date(DATE_ATOM, filemtime($path)),
                'created_by' => $meta['created_by'] ?? null,
                'encrypted' => (bool) ($meta['encrypted'] ?? false),
                'counts' => $meta['counts'] ?? null,
                'files' => $meta['files'] ?? null,
                'uploaded' => (bool) ($meta['uploaded'] ?? false),
                // Made automatically just before restoring this backup (restoring it undoes that restore).
                'safety_for' => $meta['safety_for'] ?? null,
            ];
        }

        usort($items, fn ($a, $b) => strcmp($b['name'], $a['name']));

        return $items;
    }

    /**
     * Make a new backup. Only one runs at a time.
     */
    public function create(User $actor, ?string $password = null): array
    {
        return $this->withLock(fn () => $this->createUnlocked($actor, $password));
    }

    /** Runs $work while no other backup or restore can start. */
    private function withLock(callable $work)
    {
        $lock = fopen($this->directory() . DIRECTORY_SEPARATOR . '.lock', 'c');

        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
            if ($lock) {
                fclose($lock);
            }

            throw new RuntimeException('Another backup or restore is running. Please wait a moment and try again.');
        }

        try {
            return $work();
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function createUnlocked(User $actor, ?string $password = null): array
    {
        $directory = $this->directory();

        $name = 'siknayan-backup-' . now()->format('Ymd-His') . '.zip';
        $zipPath = $directory . DIRECTORY_SEPARATOR . $name;
        $sqlPath = $directory . DIRECTORY_SEPARATOR . '.database-' . bin2hex(random_bytes(6)) . '.sql';

        try {
            if (is_file($zipPath)) {
                throw new RuntimeException('A backup was just made. Please wait a second and try again.');
            }

            $this->dumper->dump($sqlPath);

            $counts = $this->counts();
            $zip = new ZipArchive();

            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
                throw new RuntimeException('The backup file could not be created.');
            }

            if ($password !== null && $password !== '') {
                $zip->setPassword($password);
            }

            $add = function (string $source, string $entry, bool $fromString = false) use ($zip, $password) {
                $ok = $fromString ? $zip->addFromString($entry, $source) : $zip->addFile($source, $entry);

                if (!$ok) {
                    throw new RuntimeException("Could not add {$entry} to the backup.");
                }

                if ($password !== null && $password !== '') {
                    $zip->setEncryptionName($entry, ZipArchive::EM_AES_256);
                }
            };

            $add($sqlPath, 'database.sql');

            $fileCount = 0;
            $fileBytes = 0;

            foreach (config('backup.folders', []) as $folder => $prefix) {
                if (!is_dir($folder)) {
                    continue;
                }

                $files = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($folder, RecursiveDirectoryIterator::SKIP_DOTS)
                );

                foreach ($files as $file) {
                    if (!$file->isFile() || $file->getFilename() === '.gitignore') {
                        continue;
                    }

                    $relative = str_replace('\\', '/', substr($file->getPathname(), strlen($folder) + 1));
                    $add($file->getPathname(), $prefix . '/' . $relative);
                    $fileCount++;
                    $fileBytes += $file->getSize();
                }
            }

            $manifest = [
                'system' => 'Siknayan LMS (MPSU ETEEAP)',
                'created_at' => now()->toIso8601String(),
                'created_by' => $actor->name,
                'database' => config('database.connections.' . config('database.default') . '.database'),
                'counts' => $counts,
                'files' => ['count' => $fileCount, 'bytes' => $fileBytes],
                'encrypted' => $password !== null && $password !== '',
                'not_included' => ['.env settings file', 'rows of temporary tables: ' . implode(', ', config('backup.skip_data_tables', []))],
            ];

            $add(json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), 'manifest.json', true);
            $add($this->restoreGuide(), 'RESTORE.txt', true);

            if (!$zip->close()) {
                throw new RuntimeException('The backup file could not be finished.');
            }

            // A few details to list the backup without opening it (no password).
            $meta = $manifest;
            unset($meta['not_included']);
            file_put_contents($zipPath . '.json', json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return collect($this->list())->firstWhere('name', $name);
        } catch (\Throwable $error) {
            @unlink($zipPath);
            @unlink($zipPath . '.json');
            throw $error;
        } finally {
            @unlink($sqlPath);
        }
    }

    public function delete(string $name): bool
    {
        $path = $this->path($name);

        if (!$path) {
            return false;
        }

        @unlink($path . '.json');

        return @unlink($path);
    }

    /**
     * Put a saved backup back: database and uploaded files.
     *
     * 1. The zip is checked (a Siknayan backup, the right zip password)
     *    and unpacked to a temporary folder (only expected paths).
     * 2. A safety backup of the CURRENT system is made first.
     * 3. The database is replaced, then migrations bring it up to date.
     *    If that fails, the safety backup's database is put back.
     * 4. The uploaded-file folders are replaced with the backup's files.
     *
     * Returns ['restored' => name, 'safety_backup' => name, 'manifest' => [...]].
     */
    public function restore(User $actor, string $name, ?string $zipPassword = null): array
    {
        return $this->withLock(function () use ($actor, $name, $zipPassword) {
            $path = $this->path($name);

            if (!$path) {
                throw new RuntimeException('Backup not found.');
            }

            $work = $this->directory() . DIRECTORY_SEPARATOR . '.restore-' . bin2hex(random_bytes(6));
            File::ensureDirectoryExists($work, 0700);

            try {
                $manifest = $this->unpack($path, $work, $zipPassword);

                // Safety copy of what is there now (no password, kept in the list).
                $safety = $this->createUnlocked($actor, null);
                $this->markAsSafety($safety['name'], $name);

                try {
                    $this->importer->replaceDatabase($work . DIRECTORY_SEPARATOR . 'database.sql');
                    Artisan::call('migrate', ['--force' => true]);
                } catch (\Throwable $error) {
                    $this->putBackSafetyDatabase($safety['name']);

                    throw new RuntimeException(
                        'The backup could not be restored, so the system was put back as it was '
                        . "(safety backup {$safety['name']}). Details: " . $error->getMessage()
                    );
                }

                $files = $this->replaceFolders($work);

                return [
                    'restored' => $name,
                    'safety_backup' => $safety['name'],
                    'manifest' => $manifest,
                    'files' => $files,
                ];
            } finally {
                File::deleteDirectory($work);
            }
        });
    }

    /**
     * Add a backup zip uploaded from another computer to the list, after
     * checking it is a Siknayan backup. Returns the list entry.
     */
    public function storeUpload(UploadedFile $file): array
    {
        return $this->withLock(function () use ($file) {
            $zip = new ZipArchive();

            if ($zip->open($file->getRealPath()) !== true) {
                throw new RuntimeException('That file is not a valid zip file.');
            }

            try {
                if ($zip->locateName('database.sql') === false || $zip->locateName('manifest.json') === false) {
                    throw new RuntimeException('That zip is not a Siknayan backup (database.sql or manifest.json is missing).');
                }

                $encrypted = (int) ($zip->statName('manifest.json')['encryption_method'] ?? 0) !== 0;
                $manifest = $encrypted ? null : json_decode((string) $zip->getFromName('manifest.json'), true);

                if (!$encrypted && !$this->isSiknayanManifest($manifest)) {
                    throw new RuntimeException('That zip is not a Siknayan backup.');
                }
            } finally {
                $zip->close();
            }

            // A new, unused name in the usual pattern.
            $moment = now();
            do {
                $name = 'siknayan-backup-' . $moment->format('Ymd-His') . '.zip';
                $moment = $moment->addSecond();
            } while (is_file($this->directory() . DIRECTORY_SEPARATOR . $name));

            $target = $this->directory() . DIRECTORY_SEPARATOR . $name;

            if (!copy($file->getRealPath(), $target)) {
                throw new RuntimeException('The uploaded backup could not be saved.');
            }

            $meta = $manifest ? $manifest : ['encrypted' => true];
            unset($meta['not_included']);
            $meta['created_at'] = $meta['created_at'] ?? now()->toIso8601String();
            $meta['uploaded'] = true;
            $meta['uploaded_at'] = now()->toIso8601String();
            $meta['original_file_name'] = mb_substr($file->getClientOriginalName(), 0, 120);
            file_put_contents($target . '.json', json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            return collect($this->list())->firstWhere('name', $name);
        });
    }

    private function isSiknayanManifest($manifest): bool
    {
        return is_array($manifest) && str_starts_with((string) ($manifest['system'] ?? ''), 'Siknayan LMS');
    }

    /**
     * Checks the zip and unpacks database.sql and the uploaded files into
     * $work. Only "database.sql" and paths under the known file folders are
     * taken; anything else (or a path trying to leave the folder) is skipped.
     */
    private function unpack(string $path, string $work, ?string $zipPassword): array
    {
        $zip = new ZipArchive();

        if ($zip->open($path) !== true) {
            throw new RuntimeException('The backup file could not be opened.');
        }

        try {
            if ($zip->locateName('database.sql') === false || $zip->locateName('manifest.json') === false) {
                throw new RuntimeException('This is not a complete Siknayan backup (database.sql or manifest.json is missing).');
            }

            $encrypted = (int) ($zip->statName('database.sql')['encryption_method'] ?? 0) !== 0;

            if ($encrypted) {
                if ($zipPassword === null || $zipPassword === '') {
                    throw new RuntimeException('This backup is password-protected. Enter the backup password that was used when it was made.');
                }

                $zip->setPassword($zipPassword);
            }

            $manifest = json_decode((string) $zip->getFromName('manifest.json'), true);

            if (!$this->isSiknayanManifest($manifest)) {
                throw new RuntimeException($encrypted
                    ? 'The backup password is incorrect.'
                    : 'This is not a Siknayan backup.');
            }

            $prefixes = array_map(fn ($prefix) => rtrim($prefix, '/') . '/', array_values(config('backup.folders', [])));

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $entry = (string) $zip->getNameIndex($i);

                if ($entry === '' || str_ends_with($entry, '/')) {
                    continue;
                }

                $allowed = $entry === 'database.sql'
                    || collect($prefixes)->contains(fn ($prefix) => str_starts_with($entry, $prefix));

                $unsafe = str_contains($entry, '\\')
                    || str_contains($entry, ':')
                    || str_starts_with($entry, '/')
                    || in_array('..', explode('/', $entry), true);

                if (!$allowed || $unsafe) {
                    continue;
                }

                $contents = $zip->getFromIndex($i);

                if ($contents === false) {
                    throw new RuntimeException($encrypted
                        ? 'The backup password is incorrect.'
                        : "Could not read {$entry} from the backup.");
                }

                $target = $work . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $entry);
                File::ensureDirectoryExists(dirname($target), 0700);
                file_put_contents($target, $contents);
            }

            if (!is_file($work . DIRECTORY_SEPARATOR . 'database.sql')) {
                throw new RuntimeException('The backup database could not be read.');
            }

            unset($manifest['not_included']);

            return $manifest;
        } finally {
            $zip->close();
        }
    }

    /** Notes in a backup's details that it was made just before restoring $restoring. */
    private function markAsSafety(string $safetyName, string $restoring): void
    {
        $metaPath = $this->path($safetyName) . '.json';
        $meta = json_decode((string) @file_get_contents($metaPath), true) ?: [];
        $meta['safety_for'] = $restoring;
        @file_put_contents($metaPath, json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }

    /** After a failed restore: the safety backup's database goes back in. */
    private function putBackSafetyDatabase(string $safetyName): void
    {
        $work = $this->directory() . DIRECTORY_SEPARATOR . '.rollback-' . bin2hex(random_bytes(6));
        File::ensureDirectoryExists($work, 0700);

        try {
            $this->unpack($this->path($safetyName), $work, null);
            $this->importer->replaceDatabase($work . DIRECTORY_SEPARATOR . 'database.sql');
            Artisan::call('migrate', ['--force' => true]);
        } catch (\Throwable $error) {
            report($error);
        } finally {
            File::deleteDirectory($work);
        }
    }

    /**
     * Each uploaded-file folder is replaced with the backup's copy (files
     * added after the backup was made are in the safety backup).
     */
    private function replaceFolders(string $work): int
    {
        $count = 0;

        foreach (config('backup.folders', []) as $folder => $prefix) {
            $source = $work . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, trim($prefix, '/'));

            File::ensureDirectoryExists($folder);

            // Empty the folder, keeping its .gitignore.
            foreach (File::directories($folder) as $directory) {
                File::deleteDirectory($directory);
            }
            foreach (File::files($folder, true) as $existing) {
                if ($existing->getFilename() !== '.gitignore') {
                    @unlink($existing->getPathname());
                }
            }

            if (is_dir($source)) {
                File::copyDirectory($source, $folder);
                $count += count(File::allFiles($source));
            }
        }

        return $count;
    }

    /** How many records the backup holds (shown in the list). */
    private function counts(): array
    {
        $count = fn (string $table) => DB::getSchemaBuilder()->hasTable($table) ? DB::table($table)->count() : 0;

        return [
            'users' => $count('users'),
            'classes' => $count('courses'),
            'modules' => $count('modules'),
            'submissions' => $count('submissions'),
            'grades' => $count('grades'),
        ];
    }

    private function restoreGuide(): string
    {
        return <<<'TXT'
SIKNAYAN LMS - HOW TO RESTORE THIS BACKUP
==========================================

This backup holds:
  database.sql   every table (temporary tables such as sessions, sign-in
                 tokens and pending email codes without their rows:
                 everyone simply logs in again)
  files/         uploaded files
                 files/private                -> backend/storage/app/private
                 files/public/profile-photos  -> backend/storage/app/public/profile-photos
  manifest.json  when it was made, by whom, and what it holds

NOT included: the backend/.env settings file. Keep your own private copy
of it (it holds the database and email passwords and APP_KEY). Without the
same APP_KEY, the restored system still works, but everyone must log in again.

XAMPP is NOT required. Use whichever applies to your server.

BEFORE YOU START
  If the current system still runs, make a fresh backup of it first.
  If this zip asks for a password, it is the password typed when the
  backup was made. It is not stored anywhere; without it the backup
  cannot be opened. Use 7-Zip or WinRAR (Windows' built-in zip tool
  cannot open AES-protected zips), or "7z x backup.zip" on Linux.

STEP 1 - PUT BACK THE DATABASE (importing replaces the tables already there)
  A) Hosted server (a web host or cloud database):
     Open the host's database panel (for example phpMyAdmin, Adminer or the
     provider's "Import" tool), select the Siknayan database and import
     database.sql. Or, from a terminal that can reach the database:
         mysql -h DB_HOST -P DB_PORT -u DB_USERNAME -p DB_DATABASE < database.sql
     (use the DB_ values from backend/.env; it asks for the password).
  B) Docker (docker compose):
         docker compose exec -T mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < database.sql
  C) This computer (Herd, Laragon, XAMPP or any local MySQL/MariaDB):
     Use phpMyAdmin / HeidiSQL / MySQL Workbench -> Import database.sql,
     or the same "mysql ... < database.sql" command as in A.

STEP 2 - PUT BACK THE UPLOADED FILES
  Copy the folders inside files/ to the places listed above.
  Docker: they are inside the project's backend folder on the host,
  so copy them there.

STEP 3 - START THE SYSTEM
  Make sure backend/.env is in place, then start the backend (it runs any
  missing database updates by itself under Docker; otherwise run
  "php artisan migrate") and log in.
TXT;
    }
}
