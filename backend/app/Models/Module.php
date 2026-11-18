<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Module extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The student pages and several controllers read `name`; the column is `title`.
     * `has_material` tells pages whether a file can be downloaded.
     */
    protected $appends = ['name', 'has_material'];

    /**
     * The storage location is internal; pages get has_material and
     * material_name instead.
     */
    protected $hidden = ['material_path'];

    protected $fillable = [
        'course_id',
        'title',
        'description',
        'material_path',
        'material_name',
        'module_order',
        'is_published',
        'library_key',
    ];

    /**
     * Stored materials live on the private disk under this folder.
     */
    public const MATERIAL_FOLDER = 'module-materials/';

    protected function casts(): array
    {
        return [
            'module_order' => 'integer',
            'is_published' => 'boolean',
        ];
    }

    public function getNameAttribute(): ?string
    {
        return $this->title;
    }

    public function getHasMaterialAttribute(): bool
    {
        return self::isStoredMaterialPath($this->material_path);
    }

    /**
     * True for a path inside the private module-materials folder, e.g.
     * "module-materials/AbC123.pdf". Rejects display names and "..".
     */
    public static function isStoredMaterialPath(?string $path): bool
    {
        if ($path === null || $path === '') {
            return false;
        }

        $path = str_replace('\\', '/', $path);

        return str_starts_with($path, self::MATERIAL_FOLDER)
            && !str_contains($path, '..')
            && strlen($path) > strlen(self::MATERIAL_FOLDER);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    public function progress(): HasMany
    {
        return $this->hasMany(Progress::class);
    }

    /** The module's activity list, shared by every learner's scoring card. */
    public function activities(): HasMany
    {
        return $this->hasMany(ModuleActivity::class)->orderBy('position')->orderBy('id');
    }
}