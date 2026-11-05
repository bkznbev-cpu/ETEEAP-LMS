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
}
