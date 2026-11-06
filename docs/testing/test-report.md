# Siknayan: Unit and Integration Test Report

Report for the manuscript team, following Section 8 of *Siknayan_Unit_and_Integration_Test_Plan.md*.

**Files that come with this report** (all in `docs/testing/`):

| File | What it is |
|---|---|
| `evidence/test-results.xml` | JUnit XML of the final run: every test, file, result, time. |
| `evidence/test-output.txt` | Plain-text copy of the final run's terminal output (`--no-ansi`). |
| `evidence/test-results-baseline.xml`, `evidence/test-output-baseline.txt` | The same two files for the first run, before any change. |
| `requirement-map.md` | Step 2 working notes: how the original 260 tests were matched to requirements. Superseded by this report where they differ. |

The XML and text files come from **one** run of `php artisan test --no-ansi --log-junit storage/test-results.xml`, so they match each other. Neither records the date, so it is stated below.

---

## 8.1 Run summary

| Item | Value |
|---|---|
| Date and time of final run | 2026-11-04, 16:19:37 (the computer's clock is set to UTC, +0000) |
| PHP | 8.4.26 (`C:\php84\php.exe`) |
| Laravel | 13.33.0 |
| PHPUnit | 12.5.36 |
| Database for tests | SQLite in memory (from `phpunit.xml`); the real database is never touched |
| **Tests** | **335** |
| **Passed** | **328** |
| **Incomplete** | **7** (requirements the system does not meet; see 8.5) |
| **Failed** | **0** |
| Assertions | 1,937 |
| Duration | 64.3 s |
| Code coverage | Not measured: neither PCOV nor Xdebug is installed. |

Terminal summary line, as printed:

```
  Tests:    7 incomplete, 328 passed (1937 assertions)
  Duration: 64.30s
```

Baseline before any change (same day, 15:48): 260 tests, 260 passed, 1,741 assertions.

**Screenshot:** not taken by Claude. A team member should take it (see "For the screenshot" at the end).

---

## 8.2 Summary table

Each test is counted **once**, under the first requirement it is tagged with. A test that also checks other requirements is counted in those rows in the per-requirement table below.

| Requirement group | Unit tests | Integration tests | Total | Passed | Incomplete (discrepancy) | Failed |
|---|---|---|---|---|---|---|
| Authentication | 0 | 53 | 53 | 53 | 0 | 0 |
| User Management | 0 | 52 | 52 | 52 | 0 | 0 |
| Module Library | 4 | 7 | 11 | 11 | 0 | 0 |
| Class Management | 0 | 30 | 30 | 29 | 1 | 0 |
| Submission | 5 | 15 | 20 | 20 | 0 | 0 |
| Grading and Feedback | 6 | 11 | 17 | 17 | 0 | 0 |
| Progress Tracking and Reports | 0 | 13 | 13 | 13 | 0 | 0 |
| Class Announcements | 0 | 12 | 12 | 12 | 0 | 0 |
| Notification Management | 0 | 24 | 24 | 21 | 3 | 0 |
| System Administration | 6 | 31 | 37 | 37 | 0 | 0 |
| Role-based access (NFR-S-02) | 0 | 32 | 32 | 32 | 0 | 0 |
| Other non-functional (NFR-S-01, S-03, S-04, S-05, U-02, R-01) | 5 | 15 | 20 | 17 | 3 | 0 |
| Supporting tests (no listed requirement) | 1 | 13 | 14 | 14 | 0 | 0 |
| **Total** | **27** | **308** | **335** | **328** | **7** | **0** |

"Supporting tests" check things outside the requirement list: profile pages, the database seeder, the System Admin setup command, and two Laravel placeholder tests.

### Tests per requirement

A test counts for **every** requirement it is tagged with, so these numbers add up to more than 335.

| Requirement | Unit | Integration | Passed | Incomplete | Failed |
|---|---|---|---|---|---|
| FR-AU-01 | 0 | 7 | 7 | 0 | 0 |
| FR-AU-02 | 0 | 18 | 18 | 0 | 0 |
| FR-AU-03 | 0 | 11 | 11 | 0 | 0 |
| FR-AU-04 | 0 | 20 | 20 | 0 | 0 |
| FR-AU-05 | 0 | 4 | 4 | 0 | 0 |
| FR-UM-01 | 0 | 31 | 31 | 0 | 0 |
| FR-UM-02 | 0 | 8 | 8 | 0 | 0 |
| FR-UM-03 | – | – | – | – | – |
| FR-UM-04 | 0 | 14 | 14 | 0 | 0 |
| FR-ML-01 | – | – | – | – | – |
| FR-ML-02 | – | – | – | – | – |
| FR-ML-03 | 5 | 8 | 13 | 0 | 0 |
| FR-CM-01 | 0 | 11 | 11 | 0 | 0 |
| FR-CM-02 | 0 | 2 | 2 | 0 | 0 |
| FR-CM-03 | 0 | 3 | 3 | 0 | 0 |
| FR-CM-04 | 0 | 4 | 3 | 1 | 0 |
| FR-CM-05 | 0 | 7 | 7 | 0 | 0 |
| FR-CM-06 | 0 | 6 | 6 | 0 | 0 |
| FR-CM-07 | 0 | 4 | 4 | 0 | 0 |
| FR-CM-08 | 0 | 1 | 1 | 0 | 0 |
| FR-SM-01 | 5 | 7 | 12 | 0 | 0 |
| FR-SM-02 | 0 | 3 | 3 | 0 | 0 |
| FR-SM-03 | 0 | 5 | 5 | 0 | 0 |
| FR-SM-04 | 0 | 1 | 1 | 0 | 0 |
| FR-GF-01 | 6 | 8 | 14 | 0 | 0 |
| FR-GF-02 | 0 | 2 | 2 | 0 | 0 |
| FR-GF-03 | 0 | 3 | 3 | 0 | 0 |
| FR-GF-04 | 0 | 6 | 6 | 0 | 0 |
| FR-PT-01 | 0 | 2 | 2 | 0 | 0 |
| FR-PT-02 | 0 | 4 | 4 | 0 | 0 |
| FR-PT-03 | 0 | 2 | 2 | 0 | 0 |
| FR-PT-04 | 0 | 3 | 3 | 0 | 0 |
| FR-PT-05 | 0 | 2 | 2 | 0 | 0 |
| FR-PT-06 | 0 | 3 | 3 | 0 | 0 |
| FR-CA-01 | 0 | 6 | 6 | 0 | 0 |
| FR-CA-02 | 0 | 6 | 6 | 0 | 0 |
| FR-CA-03 | 0 | 2 | 2 | 0 | 0 |
| FR-NM-01 | 0 | 2 | 0 | 2 | 0 |
| FR-NM-02 | 0 | 2 | 2 | 0 | 0 |
| FR-NM-03 | 0 | 5 | 5 | 0 | 0 |
| FR-NM-04 | 0 | 5 | 5 | 0 | 0 |
| FR-NM-05 | 0 | 5 | 4 | 1 | 0 |
| FR-NM-06 | 0 | 2 | 2 | 0 | 0 |
| FR-NM-07 | 0 | 6 | 6 | 0 | 0 |
| FR-NM-08 | – | – | – | – | – |
| FR-SA-01 | 0 | 7 | 7 | 0 | 0 |
| FR-SA-02 | 0 | 7 | 7 | 0 | 0 |
| FR-SA-03 | 6 | 17 | 23 | 0 | 0 |
| FR-SA-04 | 0 | 3 | 3 | 0 | 0 |
| FR-SA-05 | 0 | 2 | 2 | 0 | 0 |
| FR-SA-06 | 0 | 1 | 1 | 0 | 0 |
| NFR-S-01 | 0 | 3 | 3 | 0 | 0 |
| NFR-S-02 | 0 | 68 | 68 | 0 | 0 |
| NFR-S-03 | 5 | 4 | 7 | 2 | 0 |
| NFR-S-04 | 0 | 3 | 2 | 1 | 0 |
| NFR-S-05 | 0 | 8 | 8 | 0 | 0 |
| NFR-U-02 | 0 | 1 | 1 | 0 | 0 |
| NFR-R-01 | 0 | 2 | 2 | 0 | 0 |

The two passing NFR-S-04 tests check the 8-hour token expiry and how often "last used" is saved. They do not show that the 30-minute requirement is met; the third test, which checks 30 minutes, is incomplete.

### How to run one requirement's tests

Every test carries PHPUnit 12 `#[Group]` tags: its level (`unit` or `integration`), its group prefix (e.g. `FR-SM`) and its exact requirement IDs (e.g. `FR-SM-03`). Tests for unmet requirements also carry `discrepancy`.

```
C:\php84\php.exe artisan test --group=FR-SM-03
C:\php84\php.exe artisan test --group=unit
C:\php84\php.exe artisan test --group=discrepancy
```

---

## 8.3 Full test list

See the appendix at the end of this file: 335 rows (file, test, requirement IDs, level, result). Tests that use a data provider (RoleAccessTest) appear once per data set, numbered `#1`, `#2`, ….

---

## 8.4 Requirements not covered

| Requirement | Why there is no PHPUnit test |
|---|---|
| FR-UM-03 Download School IDs and passwords as Excel or PDF | **Browser-only.** The files are built in the browser with SheetJS and jsPDF (`academic-admin/js/accounts-learners.js`, `accounts-instructors.js`). The server sends no file. |
| FR-ML-01 Add Programs | **Browser-only.** Programs are stored in the browser's localStorage (`siknayan_academic_admin_module_library_v3`, in `academic-admin/js/module-library-data.js`). There is no Program table or API. |
| FR-ML-02 Add Courses under a Program | **Browser-only.** Same as FR-ML-01. |
| FR-NM-08 Filter notifications by category | **Browser-only.** The API returns all of a user's notifications; the pages group them by `type`. |

Requirements that are covered in part, with the rest in the browser:

| Requirement | Tested on the server | Browser-only part |
|---|---|---|
| FR-AU-01 | Login with School ID and password, wrong password, missing fields | The Terms of Service checkbox. `/api/login` does not check it. |
| FR-ML-03 | File types and the 25 MB limit (unit and integration), upload, replace, download | Module titles, editing, archiving and deleting, and "deletion blocked while assigned" all live in localStorage. |
| FR-PT-03 | The data the work queue is built from (awaiting-grade count, class learner counts, class lists) | The work queue itself is put together in the browser (`academic-admin/js/dashboard.js`). |
| FR-PT-04 | `/api/admin/reports` returns class and learner records | CSV export (made in the browser as a Blob) and printing. |
| FR-PT-06 | Counts of learners, instructors, classes, active classes, submissions awaiting a grade | Program count and Module-assignment count come from localStorage. |
| NFR-U-02 | Restore needs the admin password and typing RESTORE | Delete and deactivate confirmations are browser dialogs only. The API deletes or deactivates without a confirmation field. |

Not automated by design (per the plan): NFR-PE-01, NFR-Po-03, NFR-U-01.

---

## 8.5 Discrepancies

Each discrepancy has a test that states the requirement. The test checks what the system really does; if the requirement is not met, it stops as **incomplete** with the reason, instead of failing. If the system is later changed to meet the requirement, the same test runs its real assertion and passes. No application code was changed to hide or fix these.

| # | Requirement | What the requirement says | What the system does | Test (result: incomplete) |
|---|---|---|---|---|
| 1 | NFR-S-04 | Automatic logout after 30 minutes of inactivity. | No inactivity logout, in the back end or the web pages. A login token expires **8 hours after login** (`SANCTUM_TOKEN_EXPIRATION=480` in `config/sanctum.php`), whether the user is active or not. | AuthenticationTest::test_session_expires_after_30_minutes_of_inactivity |
| 2 | NFR-S-03 | New passwords need an uppercase letter and a number. | The server checks length only. The uppercase and number rules exist only in the web pages (e.g. `student/setup.html`), so a direct API call can set `alllowercaseletters`. | AuthenticationTest::test_new_password_without_an_uppercase_letter_or_number_is_rejected |
| 3 | NFR-S-03 | System Administrator passwords: at least 15 characters. | Only password reset enforces 15. Changing your own password (`PUT /api/account/password`) needs 8 for every role, System Admin included. | AuthenticationTest::test_system_administrator_cannot_change_own_password_to_fewer_than_15_characters |
| 4 | NFR-S-03 | Same as 3. | The command that creates the first System Admin (`php artisan` CreateSystemAdmin, `app/Console/Commands/CreateSystemAdmin.php`) requires **12** characters. | No separate test. (The existing CreateSystemAdminCommandTest::test_rejects_mismatched_or_short_passwords checks that short passwords are refused, against the command's own 12-character limit, and passes.) |
| 5 | FR-NM-01 | Learner notified when added to a Class. | No notification is created. | NotificationTest::test_learner_is_notified_when_added_to_class |
| 6 | FR-NM-01 | Learner notified when a Module is assigned to their Class. | No notification is created. | NotificationTest::test_learner_is_notified_when_module_is_assigned_to_their_class |
| 7 | FR-NM-05 | Academic Admin notified when an Instructor changes a saved score. | The Academic Admin is notified when work is **first** graded ("Activity Graded"), not when a saved score is changed. The change is in the audit log, and the Learner is notified. | NotificationTest::test_academic_administrator_is_notified_when_saved_score_is_changed |
| 8 | FR-CM-04 | Only Modules from the Class's Course can be assigned. | The server stores no Course for a Class (only a Program name) and no Course for a library Module, so it accepts any Module. Only the web page limits the choice. | ClassManagementTest::test_module_from_another_course_cannot_be_assigned |

Other differences the team should know about (no test written):

- **Programs, Courses and the Module Library list are not in the database** (FR-ML-01 to 03). They live in one browser's localStorage. They are lost if that browser's data is cleared, they don't appear on another computer, and **the System Admin backup does not include them** (FR-SA-01, NFR-R-01).
- **FR-NM-06:** the System Admin is notified of **Academic Admin** lockouts only (Learner and Instructor lockouts go to their Academic Admin), and of Academic Admin accounts being created, deactivated or deleted, but not edited, reactivated or given a new password. Whether this meets "notified of account lockouts and changes to Academic Administrator accounts" is for the team to decide.
- **FR-PT-05:** the "last login" field in the learner list is `last_activity`, the time of the Learner's latest **progress** record, not their last login.
- **FR-SM-01:** the server also accepts WEBP images, which the requirement doesn't list.
- **System Admin lockout message:** the System Admin notifications page says a locked account "unlocks automatically after a minute" (`system-admin/js/shared.js`), but the lock lasts 15 minutes.
- **FR-CM-01:** a Class has `name`, `code`, `program` (free text), Instructor and active status. It has no Course field.

---

## 8.6 Answers to Section 6

1. **Lockout (NFR-S-05).** 5 wrong passwords for one account within 15 minutes lock that account for **15 minutes**, from any computer (`AuthController`, `MAX_ATTEMPTS_PER_ACCOUNT = 5`). A successful login clears the count. Unknown School IDs are limited too, and one IP address can't try many accounts. A locked Learner or Instructor notifies their Academic Admin; a locked Academic Admin notifies the System Admins. Tests: LoginSecurityTest (7 tests), AuditLogEventsTest::test_five_wrong_passwords_lock_the_account_and_are_logged_without_passwords.
2. **Automatic logout (NFR-S-04).** No 30-minute inactivity logout exists, in the back end or the front end. The back end ends a login **8 hours** after it starts (Sanctum token expiry, `SANCTUM_TOKEN_EXPIRATION`, default 480 minutes). See discrepancy 1.
3. **Module archiving (FR-ML-03).** Only in the browser: the Module Library page marks modules "archived" in localStorage. The server has no archive. When a Module is taken off a Class, the server soft-deletes that Class's copy so submissions and grades are kept.
4. **Audit log export (FR-SA-05).** Yes, server-side: `GET /api/system-admin/audit-logs/export` returns a **CSV** file. Values that could run as spreadsheet formulas are made safe, the export itself is written to the audit log, and it is limited to 10 exports a minute. Test: SystemAdminAuditLogTest::test_export_is_csv_spreadsheet_safe_and_logged.
5. **Deleting Classes, Programs and Courses.** Classes: yes, `DELETE /api/admin/classes/{id}`, refused while the Class has submissions (AcademicAdminSafeDeleteTest). Programs and Courses: there is no server endpoint, because they exist only in localStorage, so any deleting happens in the browser. Claude did not check the browser screens for this.
6. **Academic Admin notifications.** "Security" = type `account_locked`: one of their Learners or Instructors was locked out. "Grading" = type `grade`: an Instructor graded a submission for the first time ("Activity Graded"). Anything else shows under "System". Mapping in `academic-admin/js/notifications.js`.
7. **System Admin notifications.** The server sends two types: `account_locked` (an Academic Admin was locked out; "Security" tab) and `admin_account` (an Academic Admin account was created, deactivated or deleted; "Accounts" tab). **Nothing on the server creates notifications for the "Backups" or "System" tabs**, so they stay empty. Mapping in `system-admin/js/shared.js` and `system-admin/js/notifications.js`.
8. **Learner notified when added to a Class or when a Module is assigned (FR-NM-01).** No, neither. See discrepancies 5 and 6. Learners are notified of grades, grade changes and announcements.
9. **Can the Academic Admin see Class announcements?** No. There is no announcement endpoint under `/api/admin`, and no announcement screen in `academic-admin/`.
10. **Credential download and report CSV.** Both in the browser. Credentials are built with SheetJS (Excel) and jsPDF (PDF). The report CSV is built as a browser Blob, and printing uses the browser. So PHPUnit cannot test them. (Audit log CSV, by contrast, is server-side.)
11. **Architecture.** The back end is an API only. `routes/web.php` has only Laravel's default welcome page; all features are JSON endpoints in `routes/api.php`, used by the plain HTML and JavaScript pages. No Blade views are used for the system.
12. **Was AI used to write the application code?** The git history shows yes: **143 of the 233 commits** carry the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, which Claude Code adds to commits it writes. The first commit is dated 2026-09-10. Git history can't show AI tools that leave no such line, or work done before the first commit, so **the team must confirm the full answer**. This test work was also done by Claude (Claude Code, model Claude Opus 5.5) on 2026-11-04.

---

## 8.7 Changes made

### Application code: behavior-preserving changes only

To allow unit tests of the file and password rules (plan Section 3.1), three rules were moved out of the controllers into two small classes. The values are identical, and all 260 original tests still pass.

| New file | What it holds | Used by |
|---|---|---|
| `backend/app/Support/UploadRules.php` | Submission files: pdf, doc, docx, xls, xlsx, jpg, jpeg, png, webp, up to 10,240 KB. Module files: the same types, up to 25,600 KB. | `SubmissionController::store` and `AcademicAdminController::uploadModuleFile` (the inline rule lists were replaced with calls to this class). |
| `backend/app/Support/PasswordPolicy.php` | Minimum password length: 15 for `system_admin`, 8 for every other role. | `PasswordResetController::reset` (replaced the inline `system_admin ? 15 : 8`). |

No other application file was changed by this work. `GradeController.php`, `ScoreCalculator.php` and `ScoreCalculatorTest.php` already had uncommitted work before this started, and the team asked to leave it as it was. The tests were run with it in place. None of the discrepancies in 8.5 were fixed; the team decides that.

### Existing tests: tagged, not changed

- All 260 existing tests in 46 files were given `#[Group]` tags (level, group prefix, requirement IDs). **What they assert was not changed.**
- No test was moved, renamed or deleted.
- Two existing tags were widened after a closer look: LessonResourceTest::test_instructor_uploads_a_powerpoint_and_learner_can_open_it also checks that an outsider is refused (added NFR-S-02), and AnnouncementReplyTest::test_classmates_see_replies_on_the_class_page includes an Instructor reply (added FR-CA-03).

### New tests: 75

| File | Tests | Level |
|---|---|---|
| `tests/Unit/UploadRulesTest.php` | 9 | Unit |
| `tests/Unit/PasswordPolicyTest.php` | 5 | Unit |
| `tests/Feature/AuthenticationTest.php` | 7 (3 incomplete) | Integration |
| `tests/Feature/SubmissionTest.php` | 6 | Integration |
| `tests/Feature/GradingTest.php` | 4 | Integration |
| `tests/Feature/ModuleLibraryTest.php` | 3 | Integration |
| `tests/Feature/ClassManagementTest.php` | 8 (1 incomplete) | Integration |
| `tests/Feature/ProgressAndReportsTest.php` | 7 | Integration |
| `tests/Feature/NotificationTest.php` | 6 (3 incomplete) | Integration |
| `tests/Feature/RoleAccessTest.php` | 2 methods, 20 runs (4 unauthenticated + 16 role × portal) | Integration |

Plus `tests/Concerns/BuildsClassroom.php`, a shared setup helper for the new tests (no tests of its own).

### Decisions made during the work, and why

1. **Tests were tagged in place, not moved into the plan's 11-file layout (plan 3.2).** Tags give the same traceability (`--group=FR-SM-03` works), and moving would have split many files apart and hidden their history. New tests went into new files named after the plan's groups (AuthenticationTest, SubmissionTest, …). These hold only the tests that were missing.
2. **Tests for unmet requirements are "incomplete", not "failed".** The team left this to Claude. A failing test looks like broken code in the screenshot; an incomplete test still shows the requirement and the reason (`DISCREPANCY …` in the output), keeps the run readable, and turns into a passing test once the system meets the requirement. Each is listed in 8.5 and tagged `discrepancy`. If the team prefers them to fail, change `requirementNotMet()` in `tests/Concerns/BuildsClassroom.php` from `markTestIncomplete` to `fail`.
3. **Rules were extracted for unit testing (plan 3.1).** The team left this to Claude. Only rules that were plain values were moved (file rules, password length), so behavior could not change. The unsubmit rule ("only while ungraded") was **not** extracted: it is a database check inside a locked transaction, and moving it would change working code for little gain. It stays covered by UnsubmitTest (integration), and **is not separately unit tested**.
4. **No uppercase/number unit test.** The server has no such rule, so there is nothing to unit test; it is covered by integration discrepancy test 2.
5. **No new model factories (plan rule 6).** Only `User` has a factory. Adding factories would mean adding the `HasFactory` trait to the models (application code). The new tests follow the existing tests' pattern instead: records are created directly in a shared helper.
6. **The Laravel AI-agent output mode was turned off for the runs.** Laravel 13 prints only a one-line JSON summary when it detects an AI agent. The runs unset the `AI_AGENT`, `CLAUDECODE` and `CLAUDE_CODE_ENTRYPOINT` variables, so `test-output.txt` is the normal terminal output a person would see. The tests themselves are unaffected.
7. **Questionable existing tests kept, not deleted.** `LoginValidationTest::test_demo_failed_assertion` repeats part of `test_login_rejects_missing_credentials`, and its name says it fails though it passes. The two `ExampleTest` files are Laravel placeholders. None is an exact duplicate, so per plan rule 2 they were kept (tagged `FR-AU-01` and `supporting`). The team may want to rename or remove them.

---

## For the screenshot

Take it after the final tests are in place, which they now are. In VS Code, open a terminal (**Ctrl + `**) and run:

```powershell
cd backend
C:\php84\php.exe artisan test
```

Use the full `C:\php84\php.exe` path. Plain `php` on this computer is PHP 8.2 (from XAMPP), and the tests won't start under it. The run ends with `Tests: 7 incomplete, 328 passed (1937 assertions)`. Screenshot that summary. The incomplete lines appear in yellow with the `DISCREPANCY` reason.

---

## Appendix: full test list

| # | File | Test | Requirement(s) | Level | Result |
|---|---|---|---|---|---|
| 1 | AuditLoggerTest | `test_changes_preserves_false_and_null_values` | FR-SA-03 | Unit | Passed |
| 2 | AuditLoggerTest | `test_changes_reports_modified_and_added_fields_but_omits_removed_fields` | FR-SA-03 | Unit | Passed |
| 3 | AuditLoggerTest | `test_label_returns_known_and_fallback_action_labels` | FR-SA-03 | Unit | Passed |
| 4 | AuditLoggerTest | `test_target_maps_supported_models_to_audit_metadata` | FR-SA-03 | Unit | Passed |
| 5 | AuditLoggerTest | `test_target_metadata_can_be_supplied_without_a_model_or_override_model_defaults` | FR-SA-03 | Unit | Passed |
| 6 | AuditLoggerTest | `test_target_uses_model_id_when_user_or_course_identifiers_are_empty` | FR-SA-03 | Unit | Passed |
| 7 | ExampleTest | `test_that_true_is_true` | Supporting | Unit | Passed |
| 8 | PasswordPolicyTest | `test_password_shorter_than_8_characters_is_invalid` | NFR-S-03 | Unit | Passed |
| 9 | PasswordPolicyTest | `test_password_with_8_characters_is_valid_for_learners_instructors_and_academic_admins` | NFR-S-03 | Unit | Passed |
| 10 | PasswordPolicyTest | `test_system_administrator_password_shorter_than_15_characters_is_invalid` | NFR-S-03 | Unit | Passed |
| 11 | PasswordPolicyTest | `test_system_administrator_password_with_15_characters_is_valid` | NFR-S-03 | Unit | Passed |
| 12 | PasswordPolicyTest | `test_unknown_role_uses_the_8_character_minimum` | NFR-S-03 | Unit | Passed |
| 13 | ScoreCalculatorTest | `test_item_error_rejects_a_blank_title` | FR-GF-01 | Unit | Passed |
| 14 | ScoreCalculatorTest | `test_item_error_rejects_a_score_above_the_maximum_but_allows_a_perfect_score` | FR-GF-01 | Unit | Passed |
| 15 | ScoreCalculatorTest | `test_normalize_items_trims_titles_rounds_scores_and_numbers_rows_from_zero` | FR-GF-01 | Unit | Passed |
| 16 | ScoreCalculatorTest | `test_rounding_happens_before_the_score_is_compared_to_the_maximum` | FR-GF-01 | Unit | Passed |
| 17 | ScoreCalculatorTest | `test_totals_adds_scores_and_rounds_to_two_decimals` | FR-GF-01 | Unit | Passed |
| 18 | ScoreCalculatorTest | `test_totals_of_zero_scores_and_of_no_rows_are_zero` | FR-GF-01 | Unit | Passed |
| 19 | UploadRulesTest | `test_a_file_is_required` | FR-SM-01, FR-ML-03 | Unit | Passed |
| 20 | UploadRulesTest | `test_allowed_module_file_types_are_accepted` | FR-ML-03 | Unit | Passed |
| 21 | UploadRulesTest | `test_allowed_submission_file_types_are_accepted` | FR-SM-01 | Unit | Passed |
| 22 | UploadRulesTest | `test_module_file_of_25_mb_is_accepted` | FR-ML-03 | Unit | Passed |
| 23 | UploadRulesTest | `test_module_file_over_25_mb_is_rejected` | FR-ML-03 | Unit | Passed |
| 24 | UploadRulesTest | `test_other_module_file_types_are_rejected` | FR-ML-03 | Unit | Passed |
| 25 | UploadRulesTest | `test_other_submission_file_types_are_rejected` | FR-SM-01 | Unit | Passed |
| 26 | UploadRulesTest | `test_submission_file_of_10_mb_is_accepted` | FR-SM-01 | Unit | Passed |
| 27 | UploadRulesTest | `test_submission_file_over_10_mb_is_rejected` | FR-SM-01 | Unit | Passed |
| 28 | AcademicAdminAccountManagementTest | `test_academic_admin_can_change_a_learner_school_id_and_name` | FR-UM-01 | Integration | Passed |
| 29 | AcademicAdminAccountManagementTest | `test_academic_admin_can_change_an_instructor_id` | FR-UM-01 | Integration | Passed |
| 30 | AcademicAdminAccountManagementTest | `test_academic_admin_can_complete_first_login_password_setup` | FR-AU-02 | Integration | Passed |
| 31 | AcademicAdminAccountManagementTest | `test_academic_admin_can_deactivate_an_instructor` | FR-UM-01 | Integration | Passed |
| 32 | AcademicAdminAccountManagementTest | `test_academic_admin_can_deactivate_and_reactivate_a_learner` | FR-UM-01 | Integration | Passed |
| 33 | AcademicAdminAccountManagementTest | `test_academic_admin_deleting_a_class_persists_to_the_database` | FR-CM-01 | Integration | Passed |
| 34 | AcademicAdminAccountManagementTest | `test_academic_admin_reports_records_from_the_database` | FR-PT-04 | Integration | Passed |
| 35 | AcademicAdminAccountManagementTest | `test_active_user_can_log_in_and_use_the_issued_sanctum_token` | FR-AU-01 | Integration | Passed |
| 36 | AcademicAdminAccountManagementTest | `test_dashboard_reports_submitted_submissions_awaiting_a_grade` | FR-PT-03, FR-PT-06 | Integration | Passed |
| 37 | AcademicAdminAccountManagementTest | `test_deactivated_accounts_cannot_log_in` | FR-UM-01, FR-AU-01 | Integration | Passed |
| 38 | AcademicAdminAccountManagementTest | `test_inactive_user_cannot_use_an_existing_sanctum_token` | FR-UM-01, NFR-S-02 | Integration | Passed |
| 39 | AcademicAdminAccountManagementTest | `test_non_admin_cannot_change_account_status` | FR-UM-01, NFR-S-02 | Integration | Passed |
| 40 | AcademicAdminAccountManagementTest | `test_non_admin_cannot_complete_academic_admin_password_setup` | FR-AU-02, NFR-S-02 | Integration | Passed |
| 41 | AcademicAdminAccountManagementTest | `test_token_issued_after_deactivation_cannot_access_protected_routes` | FR-UM-01, NFR-S-02 | Integration | Passed |
| 42 | AcademicAdminDataSeparationTest | `test_a_new_admin_starts_with_an_empty_workspace` | NFR-S-02 | Integration | Passed |
| 43 | AcademicAdminDataSeparationTest | `test_an_admin_who_still_manages_records_cannot_be_deleted` | FR-UM-04 | Integration | Passed |
| 44 | AcademicAdminDataSeparationTest | `test_another_admins_records_cannot_be_changed_or_deleted` | NFR-S-02 | Integration | Passed |
| 45 | AcademicAdminDataSeparationTest | `test_cannot_borrow_another_admins_learner_or_instructor` | FR-CM-02, FR-CM-03, NFR-S-02 | Integration | Passed |
| 46 | AcademicAdminDataSeparationTest | `test_new_records_belong_to_the_admin_who_creates_them` | FR-UM-01, NFR-S-02 | Integration | Passed |
| 47 | AcademicAdminDataSeparationTest | `test_notifications_about_a_learner_go_only_to_their_admin` | FR-NM-05, NFR-S-02 | Integration | Passed |
| 48 | AcademicAdminDataSeparationTest | `test_school_ids_and_class_codes_stay_unique_across_admins` | FR-UM-01, FR-CM-01 | Integration | Passed |
| 49 | AcademicAdminProfilePhotoAuthorizationTest | `test_instructor_cannot_upload_an_academic_admin_profile_photo` | NFR-S-02 | Integration | Passed |
| 50 | AcademicAdminProfilePhotoAuthorizationTest | `test_learner_cannot_upload_an_academic_admin_profile_photo` | NFR-S-02 | Integration | Passed |
| 51 | AcademicAdminSafeDeleteTest | `test_account_lists_say_which_accounts_were_set_up` | FR-UM-01 | Integration | Passed |
| 52 | AcademicAdminSafeDeleteTest | `test_class_with_submissions_cannot_be_deleted` | FR-CM-01 | Integration | Passed |
| 53 | AcademicAdminSafeDeleteTest | `test_class_with_submissions_on_a_removed_module_cannot_be_deleted` | FR-CM-01 | Integration | Passed |
| 54 | AcademicAdminSafeDeleteTest | `test_class_without_learner_records_can_be_deleted` | FR-CM-01 | Integration | Passed |
| 55 | AcademicAdminSafeDeleteTest | `test_deactivated_learner_with_submissions_still_cannot_be_deleted` | FR-UM-01 | Integration | Passed |
| 56 | AcademicAdminSafeDeleteTest | `test_instructor_assigned_to_a_class_cannot_be_deleted` | FR-UM-01 | Integration | Passed |
| 57 | AcademicAdminSafeDeleteTest | `test_instructor_who_graded_work_cannot_be_deleted` | FR-UM-01 | Integration | Passed |
| 58 | AcademicAdminSafeDeleteTest | `test_instructor_without_records_can_be_deleted` | FR-UM-01 | Integration | Passed |
| 59 | AcademicAdminSafeDeleteTest | `test_learner_with_a_submission_cannot_be_deleted` | FR-UM-01 | Integration | Passed |
| 60 | AcademicAdminSafeDeleteTest | `test_learner_with_progress_cannot_be_deleted` | FR-UM-01 | Integration | Passed |
| 61 | AcademicAdminSafeDeleteTest | `test_learner_without_records_can_be_deleted` | FR-UM-01 | Integration | Passed |
| 62 | AcademicAdminSafeDeleteTest | `test_set_up_accounts_without_records_can_be_deleted` | FR-UM-01 | Integration | Passed |
| 63 | AcademicAdminSafeDeleteTest | `test_set_up_learner_with_submissions_still_cannot_be_deleted` | FR-UM-01 | Integration | Passed |
| 64 | AdminLearnerModulesTest | `test_each_learner_comes_with_their_modules_and_state` | FR-PT-05 | Integration | Passed |
| 65 | AdminNotificationTest | `test_academic_admin_can_mark_all_read_and_learners_cannot_use_admin_endpoints` | FR-NM-07, NFR-S-02 | Integration | Passed |
| 66 | AdminNotificationTest | `test_academic_admins_are_told_when_work_is_graded_once` | FR-NM-05 | Integration | Passed |
| 67 | AdminNotificationTest | `test_admins_are_not_notified_when_a_learner_finishes_password_setup` | FR-NM-05 | Integration | Passed |
| 68 | AdminNotificationTest | `test_lockout_notifies_the_right_admins_once` | FR-NM-05, FR-NM-06 | Integration | Passed |
| 69 | AdminNotificationTest | `test_old_account_setup_notifications_are_hidden_from_admins` | FR-NM-07 | Integration | Passed |
| 70 | AdminNotificationTest | `test_system_admin_can_read_and_manage_their_own_notifications` | FR-NM-07 | Integration | Passed |
| 71 | AdminNotificationTest | `test_system_admins_are_told_about_academic_admin_account_changes` | FR-NM-06 | Integration | Passed |
| 72 | AnnouncementReplyTest | `test_classmates_see_replies_on_the_class_page` | FR-CA-02, FR-CA-03 | Integration | Passed |
| 73 | AnnouncementReplyTest | `test_empty_or_too_long_replies_are_refused` | FR-CA-02 | Integration | Passed |
| 74 | AnnouncementReplyTest | `test_learner_replies_and_the_instructor_is_notified` | FR-CA-02, FR-NM-04 | Integration | Passed |
| 75 | AnnouncementReplyTest | `test_learners_delete_only_their_own_replies_and_instructors_moderate_their_class` | FR-CA-02, FR-CA-03, NFR-S-02 | Integration | Passed |
| 76 | AnnouncementReplyTest | `test_only_enrolled_learners_in_active_classes_can_reply` | FR-CA-02, NFR-S-02 | Integration | Passed |
| 77 | AnnouncementReplyTest | `test_replies_are_removed_with_the_announcement` | FR-CA-01 | Integration | Passed |
| 78 | AuditLogEventsTest | `test_deactivated_account_sign_in_is_recorded_as_refused` | FR-SA-03 | Integration | Passed |
| 79 | AuditLogEventsTest | `test_entries_cannot_be_changed_or_deleted` | FR-SA-03 | Integration | Passed |
| 80 | AuditLogEventsTest | `test_five_wrong_passwords_lock_the_account_and_are_logged_without_passwords` | FR-SA-03, NFR-S-05 | Integration | Passed |
| 81 | AuditLogEventsTest | `test_password_setup_and_change_are_recorded` | FR-SA-03 | Integration | Passed |
| 82 | AuditLogEventsTest | `test_successful_sign_in_and_sign_out_are_recorded_with_role_and_ip` | FR-SA-03 | Integration | Passed |
| 83 | AuditLogEventsTest | `test_system_admin_profile_changes_are_recorded_with_old_and_new` | FR-SA-03 | Integration | Passed |
| 84 | AuditTrailCoverageTest | `test_classes_and_enrolment` | FR-SA-03, FR-CM-01, FR-CM-03 | Integration | Passed |
| 85 | AuditTrailCoverageTest | `test_failed_backup_is_logged` | FR-SA-03, FR-SA-01 | Integration | Passed |
| 86 | AuditTrailCoverageTest | `test_instructor_grade_change_shows_old_and_new_grade` | FR-SA-03, FR-GF-04 | Integration | Passed |
| 87 | AuditTrailCoverageTest | `test_learner_account_lifecycle` | FR-SA-03, FR-UM-01 | Integration | Passed |
| 88 | AuditTrailCoverageTest | `test_module_material_upload_and_replace` | FR-SA-03, FR-ML-03 | Integration | Passed |
| 89 | AuditTrailCoverageTest | `test_real_ip_is_recorded_only_behind_a_trusted_proxy` | FR-SA-03 | Integration | Passed |
| 90 | AuthenticationTest | `test_login_fails_with_wrong_password` | FR-AU-01 | Integration | Passed |
| 91 | AuthenticationTest | `test_new_password_without_an_uppercase_letter_or_number_is_rejected` | NFR-S-03 | Integration | Incomplete |
| 92 | AuthenticationTest | `test_password_change_fails_with_wrong_current_password` | FR-AU-04 | Integration | Passed |
| 93 | AuthenticationTest | `test_passwords_are_stored_hashed` | NFR-S-01 | Integration | Passed |
| 94 | AuthenticationTest | `test_session_expires_after_30_minutes_of_inactivity` | NFR-S-04 | Integration | Incomplete |
| 95 | AuthenticationTest | `test_system_administrator_cannot_change_own_password_to_fewer_than_15_characters` | NFR-S-03 | Integration | Incomplete |
| 96 | AuthenticationTest | `test_user_can_log_in_with_valid_school_id_and_password` | FR-AU-01 | Integration | Passed |
| 97 | ClassManagementTest | `test_academic_administrator_can_add_and_remove_learners` | FR-CM-03 | Integration | Passed |
| 98 | ClassManagementTest | `test_academic_administrator_can_assign_library_modules_to_class` | FR-CM-04 | Integration | Passed |
| 99 | ClassManagementTest | `test_academic_administrator_can_create_class_with_program_and_instructor` | FR-CM-01, FR-CM-02 | Integration | Passed |
| 100 | ClassManagementTest | `test_academic_administrator_can_edit_class_and_set_status` | FR-CM-01 | Integration | Passed |
| 101 | ClassManagementTest | `test_duplicate_class_code_is_rejected` | FR-CM-01 | Integration | Passed |
| 102 | ClassManagementTest | `test_instructor_and_learner_cannot_manage_classes` | FR-CM-01, NFR-S-02 | Integration | Passed |
| 103 | ClassManagementTest | `test_instructor_sees_only_assigned_classes` | FR-CM-07 | Integration | Passed |
| 104 | ClassManagementTest | `test_module_from_another_course_cannot_be_assigned` | FR-CM-04 | Integration | Incomplete |
| 105 | CreateSystemAdminCommandTest | `test_creates_a_system_admin_who_can_log_in` | Supporting | Integration | Passed |
| 106 | CreateSystemAdminCommandTest | `test_rejects_mismatched_or_short_passwords` | NFR-S-03 | Integration | Passed |
| 107 | CreateSystemAdminCommandTest | `test_reset_changes_the_password_and_ends_sessions` | Supporting | Integration | Passed |
| 108 | CreateSystemAdminCommandTest | `test_will_not_overwrite_an_existing_account` | Supporting | Integration | Passed |
| 109 | DatabaseSeederTest | `test_seeder_creates_admin_with_a_temporary_password_not_the_old_default` | Supporting | Integration | Passed |
| 110 | DatabaseSeederTest | `test_seeding_again_does_not_reset_the_password` | Supporting | Integration | Passed |
| 111 | DuplicateEmailTest | `test_academic_admin_cannot_set_learner_or_instructor_emails` | FR-UM-01 | Integration | Passed |
| 112 | DuplicateEmailTest | `test_an_email_can_be_shared_by_two_accounts_but_not_three` | FR-AU-02, FR-AU-04 | Integration | Passed |
| 113 | DuplicateEmailTest | `test_setup_email_step_refuses_an_existing_email_in_any_case` | FR-AU-02 | Integration | Passed |
| 114 | EmailAfterPasswordSetupTest | `test_accounts_with_an_email_are_not_affected` | FR-AU-02 | Integration | Passed |
| 115 | EmailAfterPasswordSetupTest | `test_email_must_be_valid_and_not_used_by_another_account` | FR-AU-02 | Integration | Passed |
| 116 | EmailAfterPasswordSetupTest | `test_email_typed_by_an_admin_must_be_confirmed_by_the_owner` | FR-AU-02 | Integration | Passed |
| 117 | EmailAfterPasswordSetupTest | `test_instructor_and_academic_admin_must_add_email_too` | FR-AU-02 | Integration | Passed |
| 118 | EmailAfterPasswordSetupTest | `test_learner_sets_password_then_must_add_email` | FR-AU-02 | Integration | Passed |
| 119 | EmailAfterPasswordSetupTest | `test_logout_still_works_without_an_email` | FR-AU-02, FR-AU-05 | Integration | Passed |
| 120 | EmailAfterPasswordSetupTest | `test_resend_waits_a_minute` | FR-AU-02 | Integration | Passed |
| 121 | EmailChangeTest | `test_a_code_works_only_once` | FR-AU-04 | Integration | Passed |
| 122 | EmailChangeTest | `test_a_mail_failure_does_not_leave_a_pending_change` | FR-AU-04 | Integration | Passed |
| 123 | EmailChangeTest | `test_a_pending_change_can_be_cancelled` | FR-AU-04 | Integration | Passed |
| 124 | EmailChangeTest | `test_a_wrong_current_password_is_refused_and_limited` | FR-AU-04 | Integration | Passed |
| 125 | EmailChangeTest | `test_an_address_taken_before_verification_is_not_given_away` | FR-AU-04 | Integration | Passed |
| 126 | EmailChangeTest | `test_an_address_used_by_another_account_is_refused` | FR-AU-04 | Integration | Passed |
| 127 | EmailChangeTest | `test_every_role_can_change_their_email_after_verifying_it` | FR-AU-04 | Integration | Passed |
| 128 | EmailChangeTest | `test_expired_codes_do_not_work` | FR-AU-04 | Integration | Passed |
| 129 | EmailChangeTest | `test_invalid_email_formats_are_refused` | FR-AU-04 | Integration | Passed |
| 130 | EmailChangeTest | `test_people_can_only_change_their_own_email` | FR-AU-04, NFR-S-02 | Integration | Passed |
| 131 | EmailChangeTest | `test_resend_waits_a_minute_and_replaces_the_old_code` | FR-AU-04 | Integration | Passed |
| 132 | EmailChangeTest | `test_the_old_address_is_told_about_the_request_and_the_change` | FR-AU-04 | Integration | Passed |
| 133 | EmailChangeTest | `test_wrong_codes_are_counted_and_cancel_the_request` | FR-AU-04 | Integration | Passed |
| 134 | EmailDomainExistsTest | `test_change_email_refuses_a_fake_domain` | FR-AU-04 | Integration | Passed |
| 135 | EmailDomainExistsTest | `test_real_and_fake_domains` | FR-AU-02, FR-AU-04 | Integration | Passed |
| 136 | EmailDomainExistsTest | `test_setup_email_step_refuses_a_fake_domain` | FR-AU-02 | Integration | Passed |
| 137 | ExampleTest | `test_the_application_returns_a_successful_response` | Supporting | Integration | Passed |
| 138 | ForcedPasswordChangeTest | `test_account_on_temporary_password_can_still_log_out` | FR-AU-02, FR-AU-05 | Integration | Passed |
| 139 | ForcedPasswordChangeTest | `test_admin_password_reset_forces_a_change_and_logs_the_user_out` | FR-UM-01 | Integration | Passed |
| 140 | ForcedPasswordChangeTest | `test_changing_password_logs_out_other_sessions_only` | FR-AU-04 | Integration | Passed |
| 141 | ForcedPasswordChangeTest | `test_editing_a_learner_without_a_password_keeps_their_setup` | FR-UM-01 | Integration | Passed |
| 142 | ForcedPasswordChangeTest | `test_instructor_created_by_admin_must_change_password` | FR-UM-01, FR-AU-02 | Integration | Passed |
| 143 | ForcedPasswordChangeTest | `test_learner_can_change_their_own_password` | FR-AU-04 | Integration | Passed |
| 144 | ForcedPasswordChangeTest | `test_learner_created_by_admin_must_change_password` | FR-UM-01, FR-AU-02 | Integration | Passed |
| 145 | ForcedPasswordChangeTest | `test_new_instructor_and_admin_are_blocked_until_password_is_set` | FR-AU-02 | Integration | Passed |
| 146 | ForcedPasswordChangeTest | `test_new_learner_is_blocked_until_password_is_set` | FR-AU-02 | Integration | Passed |
| 147 | GradeEmailTest | `test_a_changed_score_is_emailed` | FR-NM-03, FR-GF-04 | Integration | Passed |
| 148 | GradeEmailTest | `test_a_feedback_only_change_is_not_emailed_again` | FR-NM-03, FR-GF-02 | Integration | Passed |
| 149 | GradeEmailTest | `test_learners_without_an_email_are_not_emailed` | FR-NM-03 | Integration | Passed |
| 150 | GradeEmailTest | `test_the_learner_is_emailed_when_an_activity_is_graded` | FR-NM-03 | Integration | Passed |
| 151 | GradingTest | `test_instructor_can_grade_with_a_score_over_a_maximum_and_save_feedback` | FR-GF-01, FR-GF-02 | Integration | Passed |
| 152 | GradingTest | `test_learner_can_view_own_grade_and_feedback` | FR-GF-03 | Integration | Passed |
| 153 | GradingTest | `test_learner_cannot_view_another_learners_grade` | FR-GF-03, NFR-S-02 | Integration | Passed |
| 154 | GradingTest | `test_score_above_maximum_is_rejected` | FR-GF-01 | Integration | Passed |
| 155 | ImportMultipleSheetsTest | `test_a_chosen_sheet_without_the_required_columns_is_named_in_the_error` | FR-UM-02 | Integration | Passed |
| 156 | ImportMultipleSheetsTest | `test_an_unknown_sheet_name_is_refused` | FR-UM-02 | Integration | Passed |
| 157 | ImportMultipleSheetsTest | `test_chosen_sheets_are_imported_together` | FR-UM-02 | Integration | Passed |
| 158 | ImportMultipleSheetsTest | `test_row_errors_say_which_sheet_and_duplicates_are_caught_across_sheets` | FR-UM-02 | Integration | Passed |
| 159 | ImportMultipleSheetsTest | `test_without_a_choice_only_the_active_sheet_is_imported_as_before` | FR-UM-02 | Integration | Passed |
| 160 | InstructorAnnouncementTest | `test_announcement_is_posted_even_if_the_email_fails` | FR-CA-01 | Integration | Passed |
| 161 | InstructorAnnouncementTest | `test_edit_and_delete` | FR-CA-01 | Integration | Passed |
| 162 | InstructorAnnouncementTest | `test_enrolled_learner_sees_announcements_on_the_class` | FR-CA-02 | Integration | Passed |
| 163 | InstructorAnnouncementTest | `test_instructor_posts_and_enrolled_learners_are_notified` | FR-CA-01, FR-NM-04 | Integration | Passed |
| 164 | InstructorAnnouncementTest | `test_learners_with_an_email_get_the_announcement_by_email` | FR-NM-04 | Integration | Passed |
| 165 | InstructorAnnouncementTest | `test_no_email_when_no_learner_has_an_address` | FR-NM-04 | Integration | Passed |
| 166 | InstructorAnnouncementTest | `test_other_instructors_and_learners_cannot_manage_it` | FR-CA-01, NFR-S-02 | Integration | Passed |
| 167 | InstructorAnnouncementTest | `test_title_and_message_are_required` | FR-CA-01 | Integration | Passed |
| 168 | InstructorImportTest | `test_imported_instructors_get_an_8_character_temporary_password` | FR-UM-02 | Integration | Passed |
| 169 | InstructorNotificationLinksTest | `test_class_learners_include_their_profile_photo` | FR-CM-07 | Integration | Passed |
| 170 | InstructorNotificationLinksTest | `test_learner_progress_has_one_row_per_class` | FR-PT-02 | Integration | Passed |
| 171 | InstructorNotificationLinksTest | `test_learner_reply_notifies_the_instructor_with_the_announcement` | FR-NM-04 | Integration | Passed |
| 172 | InstructorNotificationLinksTest | `test_new_submission_notification_points_to_the_learner_in_the_class` | FR-NM-02 | Integration | Passed |
| 173 | InstructorPortalTest | `test_add_and_edit_a_module` | FR-CM-06, NFR-S-02 | Integration | Passed |
| 174 | InstructorPortalTest | `test_classes_list_and_detail` | FR-CM-07 | Integration | Passed |
| 175 | InstructorPortalTest | `test_dashboard` | FR-PT-02 | Integration | Passed |
| 176 | InstructorPortalTest | `test_dashboard_counts_each_learners_ungraded_submissions` | FR-PT-02 | Integration | Passed |
| 177 | InstructorPortalTest | `test_module_material_view_and_download` | FR-CM-07 | Integration | Passed |
| 178 | InstructorPortalTest | `test_notifications` | FR-NM-07 | Integration | Passed |
| 179 | InstructorPortalTest | `test_other_roles_cannot_use_instructor_endpoints` | NFR-S-02 | Integration | Passed |
| 180 | InstructorPortalTest | `test_profile_and_password` | FR-AU-04 | Integration | Passed |
| 181 | InstructorPortalTest | `test_submissions_list_file_and_grade` | FR-SM-02, FR-GF-01 | Integration | Passed |
| 182 | InstructorWithoutEmailTest | `test_a_new_account_can_be_deactivated_and_reset_before_first_login` | FR-UM-01 | Integration | Passed |
| 183 | InstructorWithoutEmailTest | `test_an_email_sent_by_the_admin_is_ignored` | FR-UM-01 | Integration | Passed |
| 184 | InstructorWithoutEmailTest | `test_an_instructor_can_be_added_without_an_email` | FR-UM-01 | Integration | Passed |
| 185 | InstructorWithoutEmailTest | `test_editing_never_changes_the_email` | FR-UM-01 | Integration | Passed |
| 186 | LearnerImportTest | `test_import_accepts_blank_email_and_reports_skipped_email` | FR-UM-02 | Integration | Passed |
| 187 | LearnerImportTest | `test_import_ignores_the_email_column` | FR-UM-02 | Integration | Passed |
| 188 | LearnerPortalTest | `test_class_list_shows_counts_and_only_the_instructor_name` | FR-CM-05 | Integration | Passed |
| 189 | LearnerPortalTest | `test_class_page_shows_published_modules_with_my_status_and_grade` | FR-CM-05, FR-PT-01, FR-GF-03 | Integration | Passed |
| 190 | LearnerPortalTest | `test_drafts_and_other_classes_cannot_be_opened_or_submitted` | FR-CM-05, FR-SM-01, NFR-S-02 | Integration | Passed |
| 191 | LearnerPortalTest | `test_inactive_classes_are_hidden` | FR-CM-05, FR-CM-01 | Integration | Passed |
| 192 | LearnerPortalTest | `test_large_profile_photos_are_accepted_and_stored_small` | Supporting | Integration | Passed |
| 193 | LearnerPortalTest | `test_learner_can_submit_pdf_word_excel_or_a_photo` | FR-SM-01 | Integration | Passed |
| 194 | LearnerPortalTest | `test_learner_opens_only_their_own_submitted_file` | FR-SM-01, NFR-S-02 | Integration | Passed |
| 195 | LearnerPortalTest | `test_notifications_list_and_mark_read` | FR-NM-07 | Integration | Passed |
| 196 | LearnerPortalTest | `test_other_roles_cannot_use_learner_endpoints` | NFR-S-02 | Integration | Passed |
| 197 | LearnerPortalTest | `test_profile_photo_upload_replaces_the_old_one` | Supporting | Integration | Passed |
| 198 | LearnerPortalTest | `test_profile_show_and_update` | Supporting | Integration | Passed |
| 199 | LearnerPortalTest | `test_submitting_twice_is_refused_and_the_path_stays_private` | FR-SM-01 | Integration | Passed |
| 200 | LearnerRouteAuthorizationTest | `test_learners_still_reach_their_routes` | NFR-S-02 | Integration | Passed |
| 201 | LearnerRouteAuthorizationTest | `test_other_roles_are_refused_on_every_learner_route` | NFR-S-02 | Integration | Passed |
| 202 | LessonResourceTest | `test_disallowed_file_types_are_rejected` | FR-CM-06 | Integration | Passed |
| 203 | LessonResourceTest | `test_instructor_adds_a_link_for_a_module` | FR-CM-06 | Integration | Passed |
| 204 | LessonResourceTest | `test_instructor_uploads_a_powerpoint_and_learner_can_open_it` | FR-CM-06, FR-CM-08, NFR-S-02 | Integration | Passed |
| 205 | LessonResourceTest | `test_links_must_be_web_addresses` | FR-CM-06 | Integration | Passed |
| 206 | LessonResourceTest | `test_other_instructors_cannot_manage_the_class_resources` | FR-CM-06, NFR-S-02 | Integration | Passed |
| 207 | LoginSecurityTest | `test_account_is_locked_after_five_failed_attempts` | NFR-S-05 | Integration | Passed |
| 208 | LoginSecurityTest | `test_failures_older_than_fifteen_minutes_do_not_count` | NFR-S-05 | Integration | Passed |
| 209 | LoginSecurityTest | `test_lock_applies_to_the_account_from_any_computer` | NFR-S-05 | Integration | Passed |
| 210 | LoginSecurityTest | `test_lockout_lasts_fifteen_minutes` | NFR-S-05 | Integration | Passed |
| 211 | LoginSecurityTest | `test_login_token_expires_after_eight_hours` | NFR-S-04 | Integration | Passed |
| 212 | LoginSecurityTest | `test_older_slower_password_hash_is_resaved_on_sign_in` | NFR-S-01 | Integration | Passed |
| 213 | LoginSecurityTest | `test_one_address_cannot_try_many_accounts` | NFR-S-05 | Integration | Passed |
| 214 | LoginSecurityTest | `test_successful_login_resets_the_failure_count` | NFR-S-05 | Integration | Passed |
| 215 | LoginSecurityTest | `test_token_last_used_time_is_saved_at_most_once_a_minute` | NFR-S-04 | Integration | Passed |
| 216 | LoginSecurityTest | `test_unknown_school_ids_are_also_limited` | NFR-S-05 | Integration | Passed |
| 217 | LoginValidationTest | `test_demo_failed_assertion` | FR-AU-01 | Integration | Passed |
| 218 | LoginValidationTest | `test_login_rejects_missing_credentials` | FR-AU-01 | Integration | Passed |
| 219 | ModuleLibraryTest | `test_academic_administrator_can_upload_module_file` | FR-ML-03 | Integration | Passed |
| 220 | ModuleLibraryTest | `test_instructor_and_learner_cannot_upload_module_library_files` | FR-ML-03, NFR-S-02 | Integration | Passed |
| 221 | ModuleLibraryTest | `test_module_upload_rejects_file_over_25_mb` | FR-ML-03 | Integration | Passed |
| 222 | ModuleMaterialTest | `test_a_display_name_or_missing_file_is_refused_as_a_path` | FR-ML-03 | Integration | Passed |
| 223 | ModuleMaterialTest | `test_enrolled_learner_downloads_the_right_file_under_its_original_name` | FR-CM-05 | Integration | Passed |
| 224 | ModuleMaterialTest | `test_learner_can_view_the_file_in_the_browser` | FR-CM-05 | Integration | Passed |
| 225 | ModuleMaterialTest | `test_old_records_holding_only_a_display_name_are_not_offered_or_served` | FR-ML-03 | Integration | Passed |
| 226 | ModuleMaterialTest | `test_only_pdf_images_word_and_excel_can_be_uploaded` | FR-ML-03 | Integration | Passed |
| 227 | ModuleMaterialTest | `test_others_cannot_download` | FR-CM-05, NFR-S-02 | Integration | Passed |
| 228 | ModuleMaterialTest | `test_replacing_a_library_file_updates_every_class_using_it` | FR-ML-03, FR-CM-04 | Integration | Passed |
| 229 | ModuleMaterialTest | `test_sync_keeps_the_stored_path_and_the_display_name` | FR-CM-04 | Integration | Passed |
| 230 | NewLearnerAccountActionsTest | `test_a_new_learner_can_be_deactivated_and_reset_before_first_login` | FR-UM-01 | Integration | Passed |
| 231 | NotificationTest | `test_academic_administrator_is_notified_when_saved_score_is_changed` | FR-NM-05 | Integration | Incomplete |
| 232 | NotificationTest | `test_instructor_is_notified_when_learner_submits` | FR-NM-02 | Integration | Passed |
| 233 | NotificationTest | `test_learner_is_notified_in_the_app_when_grade_is_posted` | FR-NM-03 | Integration | Passed |
| 234 | NotificationTest | `test_learner_is_notified_when_added_to_class` | FR-NM-01 | Integration | Incomplete |
| 235 | NotificationTest | `test_learner_is_notified_when_module_is_assigned_to_their_class` | FR-NM-01 | Integration | Incomplete |
| 236 | NotificationTest | `test_user_can_view_own_notification_history_only` | FR-NM-07, NFR-S-02 | Integration | Passed |
| 237 | PasswordResetTest | `test_a_deactivated_account_is_refused` | FR-AU-03 | Integration | Passed |
| 238 | PasswordResetTest | `test_a_five_digit_code_is_emailed_and_stored_hashed` | FR-AU-03, NFR-S-01 | Integration | Passed |
| 239 | PasswordResetTest | `test_a_new_code_needs_a_minute_and_replaces_the_old_one` | FR-AU-03 | Integration | Passed |
| 240 | PasswordResetTest | `test_an_email_not_used_during_account_setup_fails` | FR-AU-03 | Integration | Passed |
| 241 | PasswordResetTest | `test_expired_code_and_bad_input_are_refused` | FR-AU-03 | Integration | Passed |
| 242 | PasswordResetTest | `test_requests_are_rate_limited` | FR-AU-03 | Integration | Passed |
| 243 | PasswordResetTest | `test_system_admin_needs_fifteen_characters` | FR-AU-03, NFR-S-03 | Integration | Passed |
| 244 | PasswordResetTest | `test_the_school_id_must_belong_to_the_same_account_as_the_email` | FR-AU-03 | Integration | Passed |
| 245 | PasswordResetTest | `test_two_accounts_sharing_an_email_reset_only_the_one_asked_for` | FR-AU-03 | Integration | Passed |
| 246 | PasswordResetTest | `test_verify_then_reset_signs_out_everywhere_and_code_works_once` | FR-AU-03 | Integration | Passed |
| 247 | PasswordResetTest | `test_wrong_codes_are_counted_and_the_code_is_cancelled_after_five` | FR-AU-03 | Integration | Passed |
| 248 | ProgressAndReportsTest | `test_dashboard_counts_are_correct` | FR-PT-06 | Integration | Passed |
| 249 | ProgressAndReportsTest | `test_instructor_sees_completion_for_learners_in_their_classes_only` | FR-PT-02, NFR-S-02 | Integration | Passed |
| 250 | ProgressAndReportsTest | `test_learner_list_shows_program_modules_progress_and_status` | FR-PT-05 | Integration | Passed |
| 251 | ProgressAndReportsTest | `test_learner_sees_correct_status_for_graded_waiting_and_not_submitted_modules` | FR-PT-01 | Integration | Passed |
| 252 | ProgressAndReportsTest | `test_non_administrators_cannot_access_reports_or_dashboard` | FR-PT-04, FR-PT-06, NFR-S-02 | Integration | Passed |
| 253 | ProgressAndReportsTest | `test_reports_endpoint_returns_class_and_learner_data` | FR-PT-04 | Integration | Passed |
| 254 | ProgressAndReportsTest | `test_work_queue_data_shows_learners_without_class_ungraded_work_and_empty_classes` | FR-PT-03 | Integration | Passed |
| 255 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #1` | NFR-S-02 | Integration | Passed |
| 256 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #10` | NFR-S-02 | Integration | Passed |
| 257 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #11` | NFR-S-02 | Integration | Passed |
| 258 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #12` | NFR-S-02 | Integration | Passed |
| 259 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #13` | NFR-S-02 | Integration | Passed |
| 260 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #14` | NFR-S-02 | Integration | Passed |
| 261 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #15` | NFR-S-02 | Integration | Passed |
| 262 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #16` | NFR-S-02 | Integration | Passed |
| 263 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #2` | NFR-S-02 | Integration | Passed |
| 264 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #3` | NFR-S-02 | Integration | Passed |
| 265 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #4` | NFR-S-02 | Integration | Passed |
| 266 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #5` | NFR-S-02 | Integration | Passed |
| 267 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #6` | NFR-S-02 | Integration | Passed |
| 268 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #7` | NFR-S-02 | Integration | Passed |
| 269 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #8` | NFR-S-02 | Integration | Passed |
| 270 | RoleAccessTest | `test_each_role_reaches_only_its_own_portal #9` | NFR-S-02 | Integration | Passed |
| 271 | RoleAccessTest | `test_unauthenticated_requests_are_refused #1` | NFR-S-02 | Integration | Passed |
| 272 | RoleAccessTest | `test_unauthenticated_requests_are_refused #2` | NFR-S-02 | Integration | Passed |
| 273 | RoleAccessTest | `test_unauthenticated_requests_are_refused #3` | NFR-S-02 | Integration | Passed |
| 274 | RoleAccessTest | `test_unauthenticated_requests_are_refused #4` | NFR-S-02 | Integration | Passed |
| 275 | ScoringCardTest | `test_a_single_score_is_locked_and_can_gain_activities` | FR-GF-01, FR-GF-04 | Integration | Passed |
| 276 | ScoringCardTest | `test_confirming_a_score_change_is_limited_to_the_class_instructor` | FR-GF-04, NFR-S-02 | Integration | Passed |
| 277 | ScoringCardTest | `test_invalid_rows_are_refused` | FR-GF-01 | Integration | Passed |
| 278 | ScoringCardTest | `test_other_instructors_cannot_grade` | FR-GF-01, NFR-S-02 | Integration | Passed |
| 279 | ScoringCardTest | `test_saved_scores_can_be_changed_after_password_confirmation` | FR-GF-04 | Integration | Passed |
| 280 | ScoringCardTest | `test_scores_already_given_cannot_be_changed` | FR-GF-04 | Integration | Passed |
| 281 | ScoringCardTest | `test_scoring_card_saves_rows_and_totals` | FR-GF-01 | Integration | Passed |
| 282 | SubmissionTest | `test_instructor_can_view_and_download_submissions_in_their_class` | FR-SM-02 | Integration | Passed |
| 283 | SubmissionTest | `test_instructor_cannot_download_submissions_from_another_class` | FR-SM-02, NFR-S-02 | Integration | Passed |
| 284 | SubmissionTest | `test_learner_cannot_submit_to_a_module_outside_their_classes` | FR-SM-01, NFR-S-02 | Integration | Passed |
| 285 | SubmissionTest | `test_submission_date_and_time_are_recorded` | FR-SM-04 | Integration | Passed |
| 286 | SubmissionTest | `test_submission_rejects_file_over_10_mb` | FR-SM-01 | Integration | Passed |
| 287 | SubmissionTest | `test_submission_rejects_unsupported_file_type` | FR-SM-01 | Integration | Passed |
| 288 | SystemAdminAcademicAdminManagementTest | `test_create_validates_unique_school_id_email_and_password_confirmation` | FR-UM-04 | Integration | Passed |
| 289 | SystemAdminAcademicAdminManagementTest | `test_delete_removes_only_the_target_account_and_keeps_audit_record` | FR-UM-04, FR-SA-03 | Integration | Passed |
| 290 | SystemAdminAcademicAdminManagementTest | `test_last_active_academic_admin_cannot_be_deactivated_or_deleted` | FR-UM-04 | Integration | Passed |
| 291 | SystemAdminAcademicAdminManagementTest | `test_management_routes_require_a_system_admin` | FR-UM-04, NFR-S-02 | Integration | Passed |
| 292 | SystemAdminAcademicAdminManagementTest | `test_system_admin_can_create_an_academic_admin_and_audit_it` | FR-UM-04, FR-SA-03 | Integration | Passed |
| 293 | SystemAdminAcademicAdminManagementTest | `test_system_admin_can_edit_and_deactivate_with_audit_and_token_revocation` | FR-UM-04, FR-SA-03 | Integration | Passed |
| 294 | SystemAdminAcademicAdminManagementTest | `test_system_admin_can_reactivate_an_academic_admin` | FR-UM-04 | Integration | Passed |
| 295 | SystemAdminAcademicAdminManagementTest | `test_system_admin_endpoints_cannot_target_a_different_role` | FR-UM-04, NFR-S-02 | Integration | Passed |
| 296 | SystemAdminAcademicAdminManagementTest | `test_system_admin_lists_only_academic_admin_accounts` | FR-UM-04 | Integration | Passed |
| 297 | SystemAdminAuditLogTest | `test_audit_logs_require_login` | NFR-S-02 | Integration | Passed |
| 298 | SystemAdminAuditLogTest | `test_export_is_csv_spreadsheet_safe_and_logged` | FR-SA-05 | Integration | Passed |
| 299 | SystemAdminAuditLogTest | `test_filters_and_pagination` | FR-SA-04 | Integration | Passed |
| 300 | SystemAdminAuditLogTest | `test_other_roles_cannot_read_or_export_audit_logs` | FR-SA-04, FR-SA-05, NFR-S-02 | Integration | Passed |
| 301 | SystemAdminAuditLogTest | `test_system_admin_sees_entries_newest_first_with_all_fields` | FR-SA-04 | Integration | Passed |
| 302 | SystemAdminAuditLogTest | `test_there_is_no_way_to_change_or_delete_entries` | FR-SA-03 | Integration | Passed |
| 303 | SystemAdminAuthenticationTest | `test_authenticated_non_system_admin_can_use_shared_logout` | FR-AU-05 | Integration | Passed |
| 304 | SystemAdminAuthenticationTest | `test_logout_revokes_the_current_token_and_protected_endpoints_reject_it` | FR-AU-05 | Integration | Passed |
| 305 | SystemAdminAuthenticationTest | `test_non_system_admin_roles_cannot_verify_a_system_admin_session` | NFR-S-02 | Integration | Passed |
| 306 | SystemAdminAuthenticationTest | `test_system_admin_can_log_in_and_verify_the_protected_session` | FR-AU-01 | Integration | Passed |
| 307 | SystemAdminAuthenticationTest | `test_system_admin_dashboard_returns_real_account_statistics` | FR-SA-06 | Integration | Passed |
| 308 | SystemAdminAuthenticationTest | `test_system_admin_session_requires_authentication` | NFR-S-02 | Integration | Passed |
| 309 | SystemAdminBackupTest | `test_backup_holds_database_files_and_guide_but_not_env` | FR-SA-01 | Integration | Passed |
| 310 | SystemAdminBackupTest | `test_download_and_delete` | FR-SA-01 | Integration | Passed |
| 311 | SystemAdminBackupTest | `test_only_backup_file_names_are_accepted` | FR-SA-01 | Integration | Passed |
| 312 | SystemAdminBackupTest | `test_other_roles_cannot_use_backups` | FR-SA-01, NFR-S-02 | Integration | Passed |
| 313 | SystemAdminBackupTest | `test_password_protected_backup_is_aes_encrypted` | FR-SA-01 | Integration | Passed |
| 314 | SystemAdminProfileTest | `test_invalid_input_is_rejected` | Supporting | Integration | Passed |
| 315 | SystemAdminProfileTest | `test_only_system_admins_can_use_it` | NFR-S-02 | Integration | Passed |
| 316 | SystemAdminProfileTest | `test_photo_upload_replaces_and_removes_the_old_file` | Supporting | Integration | Passed |
| 317 | SystemAdminProfileTest | `test_profile_changes_are_saved` | Supporting | Integration | Passed |
| 318 | SystemAdminProfileTest | `test_system_admin_can_view_their_profile` | Supporting | Integration | Passed |
| 319 | SystemAdminRestoreTest | `test_a_failed_restore_puts_the_previous_database_back` | FR-SA-02, NFR-R-01 | Integration | Passed |
| 320 | SystemAdminRestoreTest | `test_only_expected_paths_are_taken_from_a_zip` | FR-SA-02 | Integration | Passed |
| 321 | SystemAdminRestoreTest | `test_other_roles_cannot_restore_or_upload` | FR-SA-02, NFR-S-02 | Integration | Passed |
| 322 | SystemAdminRestoreTest | `test_password_protected_backups_need_their_backup_password` | FR-SA-01, FR-SA-02 | Integration | Passed |
| 323 | SystemAdminRestoreTest | `test_restore_needs_the_admin_password_and_typing_restore` | FR-SA-02, NFR-U-02 | Integration | Passed |
| 324 | SystemAdminRestoreTest | `test_restore_puts_back_the_database_and_files_after_a_safety_backup` | FR-SA-02, NFR-R-01 | Integration | Passed |
| 325 | SystemAdminRestoreTest | `test_uploads_must_be_siknayan_backups` | FR-SA-02 | Integration | Passed |
| 326 | SystemAdminTemporaryPasswordTest | `test_a_typed_password_is_still_accepted_and_not_echoed_back` | FR-UM-04 | Integration | Passed |
| 327 | SystemAdminTemporaryPasswordTest | `test_creating_without_email_or_password_generates_a_temporary_password` | FR-UM-04 | Integration | Passed |
| 328 | SystemAdminTemporaryPasswordTest | `test_reset_gives_a_new_temporary_password_and_ends_sessions` | FR-UM-04 | Integration | Passed |
| 329 | SystemAdminTemporaryPasswordTest | `test_reset_only_works_on_academic_admins_and_only_for_system_admins` | FR-UM-04, NFR-S-02 | Integration | Passed |
| 330 | TrustedProxyIpTest | `test_real_visitor_ip_is_logged_behind_a_trusted_proxy` | FR-SA-03 | Integration | Passed |
| 331 | UnsubmitTest | `test_graded_work_cannot_be_unsubmitted` | FR-SM-03 | Integration | Passed |
| 332 | UnsubmitTest | `test_grading_an_unsubmitted_activity_reports_it_is_gone` | FR-SM-03, FR-GF-01 | Integration | Passed |
| 333 | UnsubmitTest | `test_instructor_cannot_use_the_learner_unsubmit_route` | FR-SM-03, NFR-S-02 | Integration | Passed |
| 334 | UnsubmitTest | `test_learner_can_unsubmit_ungraded_work_and_submit_again` | FR-SM-03 | Integration | Passed |
| 335 | UnsubmitTest | `test_learner_cannot_unsubmit_someone_elses_work` | FR-SM-03, NFR-S-02 | Integration | Passed |
