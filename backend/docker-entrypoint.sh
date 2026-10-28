#!/bin/sh
# Prepares the Laravel app inside the container, then runs the command it was given.
# Safe to run on every start: each step is skipped when it is already done.
set -e
cd /var/www/html

if [ ! -f .env ]; then
    echo "Creating .env from .env.example"
    cp .env.example .env
fi

if [ ! -d vendor ]; then
    echo "Installing PHP packages (first start only, takes a few minutes)"
    composer install --no-interaction --prefer-dist --no-progress
fi

if ! grep -q '^APP_KEY=.\+' .env; then
    php artisan key:generate --force
fi

if [ "${DB_CONNECTION:-}" = "mysql" ]; then
    echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT}"
    tries=0
    until php -r 'try { new PDO("mysql:host=".getenv("DB_HOST").";port=".getenv("DB_PORT").";dbname=".getenv("DB_DATABASE"), getenv("DB_USERNAME"), getenv("DB_PASSWORD")); exit(0); } catch (Throwable $e) { exit(1); }'; do
        tries=$((tries + 1))
        if [ "$tries" -ge 60 ]; then
            echo "MySQL did not become ready in time. Check: docker compose logs mysql"
            exit 1
        fi
        sleep 2
    done
fi

php artisan migrate --force
php artisan storage:link >/dev/null 2>&1 || true

# On a hosted (production) server, keep Laravel's settings, routes and
# events in a cache so each request starts faster. Re-done on every start,
# so changes take effect after a restart.
if grep -q '^APP_ENV=production' .env; then
    php artisan config:cache
    php artisan route:cache
    php artisan event:cache
else
    php artisan optimize:clear >/dev/null 2>&1 || true
fi

# Production image (Dockerfile.production): PHP-FPM runs as www-data, which
# must be able to write logs, uploads, backups and caches.
if [ "${SIKNAYAN_FIX_PERMISSIONS:-}" = "1" ] && [ "$(id -u)" = "0" ]; then
    chown -R www-data:www-data storage bootstrap/cache
fi

exec "$@"
