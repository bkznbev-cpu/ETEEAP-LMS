# Hosting the LMS on Hostinger Web Hosting

This guide is for Hostinger **Premium** or **Business** Web Hosting (hPanel),
which has no Docker. For a VPS, use [DEPLOY.md](DEPLOY.md) instead.

How it is laid out on the hosting account:

| Folder | What is in it | Reachable from the internet? |
|---|---|---|
| `~/eteeap-lms` | The code from GitHub, including Laravel (`backend/`) and its `.env` | No |
| `~/domains/<your-domain>/public_html` | The pages, copied there by the install script | Yes |

The pages are at `https://<your-domain>/`, the API at `https://<your-domain>/api/`.

> **Not yet tested on Hostinger.** Try it first and check everything in
> step 7 before telling users.

---

## 1. In hPanel

1. **Domain:** add the domain (or a subdomain such as `lms.yourdomain.com`)
   to the hosting plan.
2. **SSL:** Security → SSL → install the free certificate for the domain.
3. **PHP:** Advanced → PHP Configuration:
   - PHP version: **8.4** (8.3 is too old: the Laravel packages need 8.4.1+).
   - PHP extensions: make sure `intl`, `gd`, `zip`, `pdo_mysql`, `fileinfo`
     and `mbstring` are ticked.
   - PHP options: set `upload_max_filesize` and `post_max_size` as high as
     the plan allows (modules are uploaded here), `memory_limit` 512M,
     `max_execution_time` 300.
4. **Database:** Databases → MySQL Databases → create one. Write down the
   database name, user name and password (the names start with `u…_`).
5. **SSH:** Advanced → SSH Access → turn it on. Note the command it shows,
   e.g. `ssh -p 65002 u123456789@123.45.67.89`.

## 2. Connect with SSH

On your computer, open PowerShell and paste the SSH command from hPanel.
Enter the hosting password when asked.

## 3. Get the code

```bash
cd ~
git clone -b hosting-ready https://github.com/bkznbev-cpu/ETEEAP-LMS.git eteeap-lms
cd eteeap-lms
```

If the GitHub repository is private, git asks for a user name and password:
use your GitHub user name and a **personal access token** (GitHub → Settings
→ Developer settings → Personal access tokens) as the password.

## 4. Settings

```bash
cp backend/.env.hostinger.example backend/.env
nano backend/.env
```

- Replace `<your-domain>` (twice) with your domain.
- Fill in `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` from step 1.4. If the
  password has spaces or `#`, put it in double quotes.
- Put the Gmail App Password in `MAIL_PASSWORD` (no spaces).
- Leave `APP_KEY` empty, keep `APP_DEBUG=false`.

Save with Ctrl+O, Enter, then close with Ctrl+X.

## 5. Install

Use your own domain in the folder name:

```bash
sh hostinger/install.sh ~/domains/<your-domain>/public_html
```

It installs Laravel's packages, creates the database tables, copies the
pages into `public_html`, and adds the web server rules (`.htaccess`).

Open `https://<your-domain>/up`: it should say the application is up.
Then open `https://<your-domain>/`: the sign-in page should show.

## 6. Bring over the data

**Option A, move the existing database** (keeps all accounts and classes).
On the current computer, export it from phpMyAdmin (database `siknayan` →
Export → SQL). In hPanel → Databases → phpMyAdmin, open the new database →
Import → choose the file. Then on SSH:

```bash
cd ~/eteeap-lms/backend && php artisan migrate --force
```

Profile photos: upload the `profile-photos` folder from the old computer's
`backend/storage/app/public/` into `~/eteeap-lms/backend/storage/app/public/`
with hPanel's File Manager.

**Option B, start empty:** create the first System Administrator:

```bash
cd ~/eteeap-lms/backend
php artisan siknayan:system-admin SYS-001 --name="System Administrator"
```

## 7. Check before telling users

Sign in once as each role (system admin, academic admin, instructor,
learner) and check:

- [ ] Sign in, sign out, and first-login password setup.
- [ ] The "Add your email" code arrives (check spam) and works.
- [ ] Forgot Password sends a code and resets the password.
- [ ] Creating a learner, a class, uploading a module, submitting and grading.
- [ ] Profile photo upload shows.
- [ ] System Admin → Data Backup creates a backup.
- [ ] `https://<your-domain>/backend/.env` shows "Not Found" (the settings
      file must never be readable).

Tell existing users before launch: **everyone confirms their email with a
code at their first sign-in on the new site.**

---

## Updating to a new version

```bash
cd ~/eteeap-lms
git pull
sh hostinger/install.sh ~/domains/<your-domain>/public_html
```

## Backups

- hPanel → Files → Backups keeps automatic copies of the files and database
  (weekly on Premium, daily on Business).
- Also download a copy now and then: phpMyAdmin → Export, and System Admin
  → Data Backup in the LMS. Keep it off the hosting account (Google Drive,
  external drive).

## If something goes wrong

| Problem | What to do |
|---|---|
| "500 Internal Server Error" on every page | Rename `public_html/.htaccess`, see if the page opens, and send me the error from hPanel → Advanced → Error Logs. |
| Pages open but signing in fails | `tail -n 50 ~/eteeap-lms/backend/storage/logs/laravel-$(date +%F).log` |
| Emails don't arrive | Check `MAIL_PASSWORD`. If Hostinger blocks Gmail, create an email account in hPanel → Emails and use `MAIL_HOST=smtp.hostinger.com`, `MAIL_PORT=465`, `MAIL_SCHEME=smtps` with that address and password. |
| Data Backup says the database could not be saved | Hostinger may not allow it on this plan. Use hPanel backups and phpMyAdmin → Export instead. |
| Changed `backend/.env` but nothing changed | `cd ~/eteeap-lms/backend && php artisan config:cache` |
| Reset a System Admin password | `cd ~/eteeap-lms/backend && php artisan siknayan:system-admin SYS-001 --reset` |

## Security notes

- `backend/.env` holds passwords. It stays in `~/eteeap-lms`, outside the
  website folder. Never copy it into `public_html` or commit it.
- Gmail sends at most about 500 emails a day.
- The LMS stores learners' personal data: agree a privacy notice and
  data-handling policy with the school (Data Privacy Act of 2012).
