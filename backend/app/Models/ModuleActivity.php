<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One activity of a module: its title and the whole-number total it is
 * scored over, shared by every learner's scoring card for the module.
 */
class ModuleActivity extends Model
{
    protected $fillable = [
        'module_id',
        'title',
        'max_score',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'max_score' => 'integer',
            'position' => 'integer',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }
}
