<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'school_id',
        'program',
        'contact',
        'password_setup_complete',
        'is_active',
        'profile_photo_path',
        // For learners and instructors: the Academic Admin who manages them.
        'owner_admin_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'password_setup_complete' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Learners, instructors and academic admins must add their own email
     * after setting their password, and confirm it with the code sent to
     * it, before using the LMS. An email typed in by an admin is not
     * confirmed, so they confirm it the same way.
     */
    public function needsEmail(): bool
    {
        return in_array($this->role, ['learner', 'instructor', 'academic_admin'], true)
            && (bool) $this->password_setup_complete
            && (trim((string) $this->email) === '' || $this->email_verified_at === null);
    }

    /** Set while confirmEmail() saves, so the email stays confirmed. */
    private bool $confirmingEmail = false;

    /** Saves an email its owner proved with a code, as confirmed. */
    public function confirmEmail(string $email): void
    {
        $this->confirmingEmail = true;

        try {
            $this->forceFill(['email' => $email, 'email_verified_at' => now()])->save();
        } finally {
            $this->confirmingEmail = false;
        }
    }

    protected static function booted(): void
    {
        // Any other change of email (e.g. typed in by an admin) is
        // unconfirmed until its owner enters the code sent to it.
        static::updating(function (User $user): void {
            if ($user->isDirty('email') && !$user->confirmingEmail) {
                $user->email_verified_at = null;
            }
        });
    }

    public function courses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'course_user');
    }

    public function instructedCourses(): HasMany
    {
        return $this->hasMany(Course::class, 'instructor_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class, 'learner_id');
    }

    public function gradesGiven(): HasMany
    {
        return $this->hasMany(Grade::class, 'instructor_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function progress(): HasMany
    {
        return $this->hasMany(Progress::class, 'learner_id');
    }
}