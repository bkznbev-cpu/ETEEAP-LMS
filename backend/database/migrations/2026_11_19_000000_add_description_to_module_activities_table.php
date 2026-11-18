<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An activity of a module keeps the description found in the module
 * file, and its Over can stay empty until the instructor sets it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('module_activities', function (Blueprint $table) {
            $table->text('description')->nullable()->after('title');
            $table->unsignedInteger('max_score')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('module_activities', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
