<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One email address may be used by up to 2 accounts (e.g. the same person
 * as a learner and as an instructor). The limit is checked by
 * App\Rules\UniqueEmail, so the database no longer requires every email
 * to be unique. A normal index keeps email lookups fast.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['email']);
            $table->index('email');
        });
    }

    public function down(): void
    {
        // Only works while no email is shared by 2 accounts.
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['email']);
            $table->unique('email');
        });
    }
};
