<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;

/**
 * Sent to the NEW email address: the 6-digit code that proves the person
 * can read mail there. The account's email changes only after the code
 * is entered.
 */
class EmailChangeCode extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $code,
        private readonly int $minutes,
        private readonly string $name,
        private readonly string $schoolId,
        // Where the code is entered, e.g. "on your profile page".
        private readonly string $where = 'on your profile page'
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirm your new email address — MPSU ETEEAP LMS')
            ->greeting('Hello ' . $this->name . ',')
            ->line('You asked to use this email address for your MPSU ETEEAP LMS account (ID: ' . $this->schoolId . '). Enter this code ' . $this->where . ' to confirm it:')
            ->line($this->codeCard())
            ->line("The code expires in {$this->minutes} minutes and can be used once. Do not share it with anyone; school staff will never ask for it.")
            ->line('If you did not ask for this, you can ignore this email. This address will not be added to the account.')
            ->salutation('MPSU ETEEAP LMS');
    }

    /** Same code card as the password reset email. */
    private function codeCard(): HtmlString
    {
        $code = e($this->code);
        $minutes = (int) $this->minutes;

        return new HtmlString(<<<HTML
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 8px 0 18px;">
    <tr>
        <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border: 1px solid #cfe5d8; border-top: 4px solid #086b3c; border-radius: 12px; background: #f3faf6;">
                <tr>
                    <td align="center" style="padding: 18px 36px 20px;">
                        <div style="color: #4b5b52; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Email Verification Code</div>
                        <div style="margin-top: 8px; color: #086b3c; font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 10px; padding-left: 10px;">{$code}</div>
                        <div style="margin-top: 8px; color: #6b7a71; font-size: 12px;">Expires in {$minutes} minutes</div>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
HTML);
    }

    /** For tests: the code that was sent. */
    public function code(): string
    {
        return $this->code;
    }
}
