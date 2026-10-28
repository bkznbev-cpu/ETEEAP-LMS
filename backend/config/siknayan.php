<?php

return [
    // Refuse email addresses whose domain doesn't exist (App\Rules\EmailDomainExists).
    'check_email_domains' => (bool) env('SIKNAYAN_CHECK_EMAIL_DOMAINS', true),
];
