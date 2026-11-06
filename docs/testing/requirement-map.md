# Requirement Map (Step 2)

> Working notes from before any test was added. The final results are in [test-report.md](test-report.md), which supersedes this file where they differ.

Baseline run: 2026-11-04 15:48, PHP 8.4.26, Laravel 13.33.0, PHPUnit 12.5.36.
Result: 260 passed (1,741 assertions), 0 failed. No test or application code was changed.

Coverage key:
- **Covered**: existing tests check the requirement on the server.
- **Partial**: some parts are tested; the gaps are listed.
- **None**: no test yet, but it can be tested.
- **Browser-only**: the feature runs only in the front-end JavaScript, so PHPUnit cannot test it.
- **Not built**: the server does not do this.

## Functional requirements

### Authentication (FR-AU)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-AU-01 | Partial | SystemAdminAuthentication: log_in…; AcademicAdminAccountManagement: active_user_can_log_in…; LoginValidation (2); LoginSecurity (lockout tests use wrong passwords) | No test named for "wrong password fails". The Terms of Service checkbox is browser-only: the `/api/login` endpoint does not check it. |
| FR-AU-02 | Covered | ForcedPasswordChange (9), EmailAfterPasswordSetup (7), DuplicateEmail, EmailDomainExists | Wrong verification code at first-login email step: check during gap filling. |
| FR-AU-03 | Covered | PasswordReset (11) | |
| FR-AU-04 | Partial | ForcedPasswordChange: learner_can_change_their_own_password, changing_password_logs_out_other_sessions_only; EmailChange (13) | No test that a wrong current password is refused for a password change. |
| FR-AU-05 | Covered | SystemAdminAuthentication: logout_revokes…, non_system_admin_can_use_shared_logout | |

### User Management (FR-UM)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-UM-01 | Covered | AcademicAdminAccountManagement (14), AcademicAdminSafeDelete (13), AcademicAdminDataSeparation (7), ForcedPasswordChange (admin reset), NewLearnerAccountActions, InstructorWithoutEmail, AuditTrailCoverage: learner_account_lifecycle | Changing a user's role: check during gap filling. Deleting is refused when a user has records (submissions, grades, classes). |
| FR-UM-02 | Covered | ImportMultipleSheets (5), LearnerImport (2), InstructorImport (1) | |
| FR-UM-03 | Browser-only | none | Excel and PDF credential files are made in the browser with SheetJS and jsPDF. |
| FR-UM-04 | Covered | SystemAdminAcademicAdminManagement (9), SystemAdminTemporaryPassword (4) | |

### Module Library (FR-ML)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-ML-01 | Browser-only | none | Programs are stored in the browser's localStorage (`siknayan_academic_admin_module_library_v3`), not in the database. |
| FR-ML-02 | Browser-only | none | Same: Courses live in localStorage. |
| FR-ML-03 | Partial | ModuleMaterial (8), AuditTrailCoverage: module_material_upload_and_replace | File types are tested. No test for the 25 MB limit. Module titles, editing, archiving and deleting live in localStorage. The "cannot delete while assigned" rule is front-end only. |

### Class Management (FR-CM)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-CM-01 | Partial | AuditTrailCoverage: classes_and_enrolment; AcademicAdminAccountManagement: deleting_a_class…; AcademicAdminSafeDelete (class tests); AcademicAdminDataSeparation: class_codes_stay_unique | A Class stores Program only as free text and has no Course field on the server. |
| FR-CM-02 | Covered | Class has one `instructor_id` column; InstructorPortal, AcademicAdminSafeDelete: instructor_assigned_to_a_class… | |
| FR-CM-03 | Covered | AuditTrailCoverage: classes_and_enrolment | No dedicated add/remove test outside the audit test. |
| FR-CM-04 | Partial | ModuleMaterial: sync_keeps_the_stored_path…, replacing_a_library_file… | The server can't check that a Module belongs to the Class's Course, because neither Course link is stored. |
| FR-CM-05 | Covered | LearnerPortal: class_page_shows_published_modules…, drafts_and_other_classes_cannot_be_opened…; ModuleMaterial: enrolled_learner_downloads…, others_cannot_download, learner_can_view… | |
| FR-CM-06 | Covered | LessonResource (5) | |
| FR-CM-07 | Covered | InstructorPortal: classes_list_and_detail; InstructorNotificationLinks: class_learners_include… | |
| FR-CM-08 | Partial | LessonResource: instructor_uploads_a_powerpoint_and_learner_can_open_it | No test that a Learner outside the Class is refused. |

### Submission (FR-SM)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-SM-01 | Partial | LearnerPortal: learner_can_submit_pdf_word_excel_or_a_photo, drafts_and_other_classes_cannot_be_opened_or_submitted, submitting_twice_is_refused… | No test for the 10 MB limit or for an unsupported type. The server also accepts WEBP, which the requirement doesn't list. |
| FR-SM-02 | Partial | InstructorPortal: submissions_list_file_and_grade | No test that another Instructor can't download the file. |
| FR-SM-03 | Covered | Unsubmit (5) | |
| FR-SM-04 | None | none | `submitted_at` exists. Add a test. |

### Grading and Feedback (FR-GF)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-GF-01 | Covered | ScoringCard (7), ScoreCalculator (6, unit) | |
| FR-GF-02 | Partial | GradeEmail: a_feedback_only_change_is_not_emailed_again | No test that feedback is saved and returned. |
| FR-GF-03 | Partial | LearnerPortal: class_page_shows…my_status_and_grade | `/student/grades` not tested directly; no test that one Learner can't see another's grade. |
| FR-GF-04 | Covered | ScoringCard: scores_already_given_cannot_be_changed, saved_scores_can_be_changed_after_password_confirmation, confirming…limited_to_the_class_instructor; AuditTrailCoverage: instructor_grade_change… | Wrong-password case: check during gap filling. |

### Progress Tracking and Reports (FR-PT)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-PT-01 | Partial | LearnerPortal: class_page_shows_published_modules_with_my_status_and_grade | Check all three statuses. |
| FR-PT-02 | Partial | InstructorNotificationLinks: learner_progress_has_one_row_per_class; InstructorPortal: dashboard… | |
| FR-PT-03 | Partial | AcademicAdminAccountManagement: dashboard_reports_submitted_submissions_awaiting_a_grade | "Learners without a Class" and "Classes without Learners" not tested. |
| FR-PT-04 | Partial | AcademicAdminAccountManagement: academic_admin_reports_records_from_the_database | One `/admin/reports` endpoint feeds all five reports. CSV export and print are browser-only. |
| FR-PT-05 | Partial | AdminLearnerModules: each_learner_comes_with_their_modules_and_state | |
| FR-PT-06 | Partial | AcademicAdminAccountManagement: dashboard… | Not every count is checked. |

### Class Announcements (FR-CA)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-CA-01 | Covered | InstructorAnnouncement (8) | |
| FR-CA-02 | Covered | AnnouncementReply (6), InstructorAnnouncement: enrolled_learner_sees… | |
| FR-CA-03 | Partial | AnnouncementReply: …instructors_moderate_their_class | Instructor reply (`POST /instructor/announcements/{id}/replies`) has no test of its own. |

### Notification Management (FR-NM)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-NM-01 | Not built | none | No notification is created when a Learner is added to a Class or a Module is assigned. |
| FR-NM-02 | Covered | InstructorNotificationLinks: new_submission_notification… | |
| FR-NM-03 | Partial | GradeEmail (4) checks emails | The in-app "Grade Updated" notification has no test. |
| FR-NM-04 | Covered | InstructorAnnouncement: instructor_posts_and_enrolled_learners_are_notified; AnnouncementReply: learner_replies_and_the_instructor_is_notified | |
| FR-NM-05 | Partial | AdminNotification: lockout_notifies_the_right_admins_once, academic_admins_are_told_when_work_is_graded_once | The Academic Admin is notified when work is first graded, **not** when a saved score is changed. |
| FR-NM-06 | Partial | AdminNotification: system_admins_are_told_about_academic_admin_account_changes, lockout… | System Admin hears only about Academic Admin lockouts, and only about create, deactivate and delete (not edit, reactivate or password reset). Nothing triggers backup or system notifications. |
| FR-NM-07 | Covered | LearnerPortal: notifications_list_and_mark_read, InstructorPortal: notifications, AdminNotification: system_admin_can_read… | |
| FR-NM-08 | Browser-only | none | The API has no category filter; the pages group notifications by `type`. |

### System Administration (FR-SA)

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| FR-SA-01 | Covered | SystemAdminBackup (5) | |
| FR-SA-02 | Covered | SystemAdminRestore (7) | |
| FR-SA-03 | Covered | AuditLogEvents (6), AuditTrailCoverage (6), AuditLogger (6, unit), TrustedProxyIp | |
| FR-SA-04 | Covered | SystemAdminAuditLog: filters_and_pagination | |
| FR-SA-05 | Covered | SystemAdminAuditLog: export_is_csv… | |
| FR-SA-06 | Partial | SystemAdminAuthentication: system_admin_dashboard_returns_real_account_statistics | Check recent activity and items needing attention. |

## Non-functional requirements

| Req | Coverage | Existing tests | Gaps / notes |
|---|---|---|---|
| NFR-S-01 | Partial | PasswordReset: code…stored_hashed; LoginSecurity: older_slower_password_hash… | No plain "password is stored hashed" test. |
| NFR-S-02 | Covered | LearnerRouteAuthorization, LearnerPortal/InstructorPortal: other_roles_cannot…, SystemAdmin*: other_roles…, AcademicAdminDataSeparation, AcademicAdminProfilePhotoAuthorization, AdminNotification | No single role-by-endpoint check yet (RoleAccessTest). |
| NFR-S-03 | Partial | PasswordReset: system_admin_needs_fifteen_characters; CreateSystemAdminCommand: rejects…short_passwords | The server checks length only. Uppercase and number rules are front-end only. |
| NFR-S-04 | Not built | LoginSecurity: login_token_expires_after_eight_hours | No 30-minute inactivity logout. Tokens expire 8 hours after login regardless of activity. |
| NFR-S-05 | Covered | LoginSecurity (10), AuditLogEvents: five_wrong_passwords_lock… | 5 failed attempts within 15 minutes lock the account for 15 minutes. |
| NFR-U-02 | Browser-only | SystemAdminRestore: restore_needs_the_admin_password_and_typing_restore | Only restore is confirmed on the server. Delete and deactivate confirmations are front-end dialogs. |
| NFR-R-01 | Covered | SystemAdminRestore: restore_puts_back_the_database_and_files… | |

## Tests that don't map to a listed requirement

These stay as they are and will be tagged with the closest group.

- Profiles: SystemAdminProfile (5), LearnerPortal profile tests (3), InstructorPortal: profile_and_password, AcademicAdminProfilePhotoAuthorization (2).
- Setup and infrastructure: DatabaseSeeder (2), CreateSystemAdminCommand (4), TrustedProxyIp (1).
- Laravel placeholders: Unit/ExampleTest (`true is true`) and Feature/ExampleTest (home page loads). They test nothing in Siknayan.
- LoginValidation: `test_demo_failed_assertion` repeats part of `test_login_rejects_missing_credentials`, and its name says it fails though it passes.

## Summary

- Covered: 27 · Partial: 23 · None: 1 · Browser-only: 5 · Not built: 2 (58 requirements: 51 FR + 7 NFR).
