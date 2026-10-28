# Hosting the MPSU ETEEAP LMS

This guide puts the LMS on a Linux server with HTTPS, using Docker.
Everything runs in four containers (`docker-compose.prod.yml`):

| Container | Job | Reachable from the internet? |
|---|---|---|
| `caddy` | HTTPS: gets and renews a free certificate, redirects `http://` to `https://` | Yes (ports 80, 443) |
| `web` | Nginx: serves the pages, passes `/api` to Laravel | No |
| `app` | Laravel API on PHP-FPM | No |
| `mysql` | The database | No |

The site and its API share one address: `https://your-domain/` for the pages,
`https://your-domain/api/` for the API. Nothing in the code needs editing per server.

> **Not yet tested:** the production containers were written without Docker
> available on the development computer. Do steps 1–6 on a test server first.

---

## What you need

- A Linux server (Ubuntu 24.04 recommended): 2 CPU, 4 GB RAM, 40 GB disk is
  plenty for a school LMS. A VPS (DigitalOcean, Hostinger VPS, AWS Lightsail…)
  or a school server.
- A domain name, e.g. `lms.mpsu.edu.ph`, with a DNS **A record** pointing at
  the server's public IP address.
- Ports **80** and **443** open in the server's firewall.
- The Gmail App Password for `mspsueteeaplms@gmail.com`
  (Google Account → Security → 2-Step Verification on → App passwords).

Shared web hosting (cPanel, without SSH or Docker) is **not** enough: the LMS
needs to run PHP 8.3+, MySQL and background commands.

---

## 1. Install Docker on the server

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER     # then log out and back in
```

## 2. Get the code

```bash
git clone <your repository URL> eteeap-lms
cd eteeap-lms
```

## 3. Settings

**Docker settings** (database passwords and the domain):

```bash
cp .env.example .env
nano .env
```

Set `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` to two long random passwords
(e.g. from `openssl rand -base64 24`), and `SITE_DOMAIN=lms.mpsu.edu.ph`.

**Laravel settings:**

```bash
cp backend/.env.production.example backend/.env
nano backend/.env
```

- Replace `<your-domain>` (twice) with the same domain.
- Put the Gmail App Password in `MAIL_PASSWORD` (no spaces).
- Leave `APP_KEY` empty; it is created on the first start.
- Keep `APP_DEBUG=false`.

## 4. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The first start takes a few minutes (building, then the database tables are
created automatically). Check that everything is up:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app caddy
```

Open `https://lms.mpsu.edu.ph`. The padlock should show in the browser.
`https://lms.mpsu.edu.ph/up` should say the application is up.

## 5. Bring over the data

**Option A, move the existing database** (keeps all accounts and classes).
On the current computer, export it from phpMyAdmin (database `siknayan` →
Export → SQL) or with:

```bash
mysqldump -u siknayan -p -P 3307 siknayan > siknayan.sql
```

Copy `siknayan.sql` to the server, then:

```bash
docker compose -f docker-compose.prod.yml exec -T mysql \
  sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < siknayan.sql
docker compose -f docker-compose.prod.yml exec app php artisan migrate --force
```

Uploaded profile photos are in `backend/storage/app/public/` on the old
computer; copy them into the `app` container's storage:

```bash
docker compose -f docker-compose.prod.yml cp ./profile-photos app:/var/www/html/storage/app/public/
docker compose -f docker-compose.prod.yml exec app chown -R www-data:www-data storage
```

**Option B, start empty:** create the first System Administrator:

```bash
docker compose -f docker-compose.prod.yml exec app php artisan siknayan:system-admin SYS-001 --name="System Administrator"
```

## 6. Check before telling users

Sign in once as each role (system admin, academic admin, instructor,
learner) and check:

- [ ] Sign in, sign out, and first-login password setup.
- [ ] The "Add your email" code arrives (check spam) and works.
- [ ] Forgot Password sends a code and resets the password.
- [ ] Creating a learner, a class, uploading a module, submitting and grading.
- [ ] Profile photo upload shows.
- [ ] System Admin → Data Backup creates a backup.

Tell existing users before launch: **everyone confirms their email with a
code at their first sign-in on the new site.**

---

## Updating to a new version

```bash
cd eteeap-lms
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Database changes run automatically on start.

## Backups (do not skip)

The database and uploads live in Docker volumes on this one server. Make a
daily backup and **copy it off the server**:

```bash
# /etc/cron.daily/siknayan-backup  (make it executable: chmod +x)
#!/bin/sh
cd /home/<user>/eteeap-lms
mkdir -p /var/backups/siknayan
docker compose -f docker-compose.prod.yml exec -T mysql \
  sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --single-transaction "$MYSQL_DATABASE"' \
  | gzip > /var/backups/siknayan/db-$(date +%F).sql.gz
find /var/backups/siknayan -name 'db-*.sql.gz' -mtime +30 -delete
```

Then copy `/var/backups/siknayan` elsewhere (Google Drive with `rclone`, another
server, or an external drive). **Test a restore once** on a test server.

## Useful commands

| Task | Command |
|---|---|
| See errors | `docker compose -f docker-compose.prod.yml logs --tail=100 app` |
| Laravel log | `docker compose -f docker-compose.prod.yml exec app tail -n 100 storage/logs/laravel-$(date +%F).log` |
| Restart | `docker compose -f docker-compose.prod.yml restart` |
| Stop | `docker compose -f docker-compose.prod.yml down` (data is kept) |
| Reset a System Admin password | `docker compose -f docker-compose.prod.yml exec app php artisan siknayan:system-admin SYS-001 --reset` |

Never run `docker compose down -v` on the server: `-v` deletes the database.

## Security notes

- `backend/.env` and `.env` hold passwords. They are ignored by git; never
  commit or share them.
- Keep the server updated: `sudo apt update && sudo apt upgrade`.
- Only ports 22 (SSH), 80 and 443 should be open:
  `sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable`.
- Gmail sends at most about 500 emails a day. If the school grows past that,
  switch `MAIL_*` to a mail service (Brevo, Mailgun, Amazon SES).
- The LMS stores learners' personal data: agree a privacy notice and
  data-handling policy with the school (Data Privacy Act of 2012).

## Development (unchanged)

On your own computer, keep using XAMPP + `php artisan serve`, or the
development containers: `docker compose up --build` (pages on
`http://localhost:8080`, API on `http://localhost:8000`).
