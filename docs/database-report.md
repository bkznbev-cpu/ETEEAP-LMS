# MPSU ETEEAP LMS: Database Review Report

**Date:** November 5, 2026
**Branch:** `hosting-ready`

This report covers how the system stores Academic Admin data, what was
found, what has been changed, and what still needs to be done.

---

## 1. Summary

- **Classes, class modules, learners and instructors** are saved in the
  correct database (MySQL).
- **Uploaded module files** are saved in the server's private file storage,
  which is correct.
- **Problem found and fixed:** each Academic Admin could see only the
  records they had created themselves. All Academic Admins now share the same
  data. This change is live on GitHub.
- **Problem found and fixed, not yet committed:** notifications were not
  shared between Academic Admins.
- **Problem found and fixed, not yet committed:** the **Module Library**
  list was saved only in each person's web browser. It is now saved in the
  database and shared by every Academic Admin.

---

## 2. Which database is used

| Environment | Database | Location |
|---|---|---|
| Local computer (development) | MySQL, database `siknayan` | `127.0.0.1`, port `3307` |
| Live site (Hostinger) | MySQL, the Hostinger database set up in hPanel | `localhost`, port `3306` |

Uploaded module files are not stored inside the database. They are saved
on the server in the private folder `storage/app/private/module-materials/`.
The database stores only each file's location and name.

---

## 3. Where each Academic Admin action is saved

| Action | Where it is saved | Correct? |
|---|---|---|
| Create or edit a class | MySQL, `courses` table | Yes |
| Assign modules to a class | MySQL, `modules` table | Yes |
| Enroll learners in a class | MySQL, `course_user` table | Yes |
| Assign an instructor to a class | MySQL, `courses.instructor_id` | Yes |
| Create learner and instructor accounts | MySQL, `users` table | Yes |
| Upload a module file (PDF etc.) | Server private storage (`module-materials/`) | Yes |
| Add programs, courses or modules to the Module Library | MySQL, `module_library` table (was browser storage only; fixed, see section 6) | Yes |

The class pages keep a copy of classes in the browser to load faster.
They always reload the real data from the database, so that copy is only
a cache.

---

## 4. Issue 1: Academic Admins could not see each other's data (fixed)

**What was happening:** every learner, instructor and class records which
Academic Admin created it (the `owner_admin_id` field). The system used this
field to **hide** records from every other Academic Admin. So only ADMIN-002,
who created most of the records, could see them. Other Academic Admins saw
empty or different lists.

**What was changed:**
- All Academic Admins now see and manage the same records: dashboard
  counts, learners, instructors, active classes, classes, module
  assignments, the module library on classes, and accounts.
- Any Academic Admin can edit or manage a record another admin created.
- `owner_admin_id` is still saved, but only to record who created
  each record.
- Replacing a module file in the library now updates every class that uses
  it, whichever admin created the class.
- No data had to be moved or copied. The records were already in one
  shared database; only the filtering was removed.

**Status:** committed (`a79adb7`) and pushed to GitHub. To make it live,
run the update steps in section 7 on the server.

---

## 5. Issue 2: Notifications were not shared (fixed, not yet committed)

**What was happening:** "Activity Graded" and "Account Locked" notifications
went only to the Academic Admin who created the related record.

**What was changed:**
- New notifications go to every active Academic Admin.
- A one-time database update (migration
  `2026_11_05_000000_share_academic_admin_notifications`) copies existing
  notifications to every Academic Admin. The copies are marked as already
  read, so old history does not show up as new alerts.
- A newly created Academic Admin gets the same notification history.
  A reactivated admin gets the notifications they missed while deactivated.
- Read/unread status stays separate for each admin.

**Status:** done and tested (all 338 backend tests pass), but **not yet
committed or pushed**.

---

## 6. Issue 3: Module Library was not in the database (fixed, not yet committed)

**What was happening:** the Module Library page (programs, courses, modules,
and which file each module uses) saves its list in the browser
(`localStorage`, in `academic-admin/js/module-library-data.js`). Only these
parts reach the server:
- the uploaded file itself, and
- a module, once it is assigned to a class.

**Effects:**
- Each Academic Admin, on each computer or browser, has their own separate
  Module Library. ADMIN-002's library does not appear for other admins.
- Clearing browser data, using another computer, or using a private window
  loses the library list. The uploaded files stay on the server.
- This is why classes look the same for every admin, but the Module
  Library does not.

**What was changed:**
- New database table `module_library` holds the whole library (programs,
  courses, modules and file details). It is included in system backups
  automatically.
- New server endpoints: `GET /api/admin/module-library` (load) and
  `PUT /api/admin/module-library` (save). Only Academic Admins can use them,
  and every save is recorded in the audit log.
- The Module Library pages now load the library from the database and send
  every change to it. The browser keeps only a fast copy.
- **Nothing is lost when moving over:** the first time each admin's browser
  connects, any programs, courses or modules it had that the database
  doesn't are added. Nothing is removed. So ADMIN-002's existing library,
  and anything another admin added on their own computer, ends up in the
  shared library.
- **Two admins saving at once:** each save says which version it started
  from. If another admin saved in between, the save is refused instead of
  overwriting their work. The page loads the latest version and asks the
  admin to make their change again.
- If a change can't reach the server (for example, no internet), it stays
  on that computer and is sent the next time an Academic Admin page opens.

**After it goes live:** ADMIN-002, and any admin who added modules on their
own computer, should open the **Module Library** page once on the computer
they used. That is when their browser's modules are added to the shared
library.

**Status:** done and tested, **not yet committed or pushed**.

---

## 7. How to put changes on the live site

Changes reach the website only after they are pushed to GitHub and then
pulled on the Hostinger server.

1. On your computer, push to GitHub (`git push`, or **Sync Changes** in
   VS Code).
2. In the SSH window connected to Hostinger, run:

   ```
   cd ~/eteeap-lms
   git pull
   SITE=$(ls ~/domains | grep -m1 613534)
   sh hostinger/install.sh ~/domains/$SITE/public_html
   ```

   `install.sh` also runs any database updates (migrations), such as the
   notification sharing in section 5.
3. Reload the site with **Ctrl+Shift+R**, so the browser doesn't show an
   old saved copy of the page.

If `git pull` says "Already up to date", the changes were not pushed to
GitHub yet.

---

## 8. Status at a glance

| Item | Status |
|---|---|
| Classes, modules, accounts saved in MySQL | Correct, no change needed |
| Module files saved in server storage | Correct, no change needed |
| Shared data across Academic Admins | Fixed, pushed to GitHub (`a79adb7`) |
| Shared notifications across Academic Admins | Fixed, not yet committed |
| Module Library saved in the database | Fixed, not yet committed |
