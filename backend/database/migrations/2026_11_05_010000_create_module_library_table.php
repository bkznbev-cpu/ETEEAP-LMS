<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Module Library (programs, courses and modules) shared by every
 * Academic Admin. It was saved only in each browser before.
 *
 * One row holds the whole library. "revision" goes up on every save, so a
 * save based on an older copy is refused instead of overwriting someone
 * else's change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('module_library', function (Blueprint $table) {
            $table->id();
            $table->longText('data');
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_library');
    }
};
