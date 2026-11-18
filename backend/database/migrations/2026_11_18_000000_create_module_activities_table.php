<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The activity list of a module: the rows every learner's scoring card
 * for that module starts with, and the whole-number total ("over") each
 * activity is scored over.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('module_activities', function (Blueprint $table) {
            $table->id();

            $table->foreignId('module_id')
                ->constrained('modules')
                ->cascadeOnDelete();

            $table->string('title', 150);
            $table->unsignedInteger('max_score');
            $table->unsignedInteger('position')->default(0);

            $table->timestamps();

            $table->index(['module_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_activities');
    }
};
