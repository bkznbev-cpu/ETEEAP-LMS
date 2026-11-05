<?php

use App\Models\User;
use App\Support\AdminNotifier;
use Illuminate\Database\Migrations\Migration;

/**
 * Academic Admins now share their records, so they share notifications
 * too. Gives every Academic Admin a copy of the notifications the others
 * already have (marked as read). New ones already go to all of them.
 */
return new class extends Migration
{
    public function up(): void
    {
        User::where('role', 'academic_admin')
            ->orderBy('id')
            ->each(fn (User $admin) => AdminNotifier::shareAcademicAdminHistory($admin));
    }

    public function down(): void
    {
        // Copies can't be told apart from the originals; nothing to undo.
    }
};
