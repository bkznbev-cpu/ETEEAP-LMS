#!/bin/sh
# Installs or updates the LMS on Hostinger Web Hosting (see HOSTINGER.md).
#
#   sh hostinger/install.sh ~/domains/<your-domain>/public_html
#
# Safe to run again after every "git pull": each step is skipped or
# redone as needed. Run it from anywhere; it finds the code by itself.
set -e

REPO=$(cd "$(dirname "$0")/.." && pwd)
WEB=${1:-}

if [ -z "$WEB" ] || [ ! -d "$WEB" ]; then
    echo "Give the website folder, e.g.:"
    echo "  sh hostinger/install.sh ~/domains/lms.example.com/public_html"
    exit 1
fi
WEB=$(cd "$WEB" && pwd)

case "$WEB" in
    "$REPO"|"$REPO"/*)
        echo "The website folder must be outside the code folder ($REPO)."
        exit 1
        ;;
esac

if [ ! -f "$REPO/backend/.env" ]; then
    echo "Missing backend/.env. Create it first:"
    echo "  cp backend/.env.hostinger.example backend/.env && nano backend/.env"
    exit 1
fi

COMPOSER=$(command -v composer || command -v composer2 || true)
if [ -z "$COMPOSER" ]; then
    echo "Composer not found. In hPanel, check that SSH access is on."
    exit 1
fi

echo "== PHP version"
php -r 'if (PHP_VERSION_ID < 80401) { fwrite(STDERR, "PHP 8.4.1 or newer is needed (found ".PHP_VERSION."). Change it in hPanel -> Advanced -> PHP Configuration.\n"); exit(1); } echo PHP_VERSION, "\n";'

echo "== Laravel packages"
cd "$REPO/backend"
"$COMPOSER" install --no-dev --optimize-autoloader --no-interaction --no-progress
mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs storage/app/public bootstrap/cache
chmod -R u+rwX storage bootstrap/cache

if ! grep -q '^APP_KEY=.\+' .env; then
    php artisan key:generate --force
fi

echo "== Database tables"
php artisan migrate --force

echo "== Speed caches"
php artisan config:cache
php artisan route:cache
php artisan event:cache

echo "== Website files -> $WEB"
cd "$REPO"
for item in *; do
    case "$item" in
        backend|docker|hostinger|*.md|docker-compose*.yml) continue ;;
    esac
    cp -R "$item" "$WEB/"
done
cp "$REPO/hostinger/htaccess" "$WEB/.htaccess"

# Laravel's entry file, pointing at the code outside the website folder.
cat > "$WEB/laravel.php" <<PHP
<?php
// Created by hostinger/install.sh: runs the Laravel API in $REPO/backend.
define('LARAVEL_START', microtime(true));
\$backend = '$REPO/backend';
if (file_exists(\$maintenance = \$backend . '/storage/framework/maintenance.php')) {
    require \$maintenance;
}
require \$backend . '/vendor/autoload.php';
\$app = require_once \$backend . '/bootstrap/app.php';
\$app->handleRequest(Illuminate\Http\Request::capture());
PHP

# Profile photos: /storage on the site shows backend/storage/app/public.
if [ -e "$WEB/storage" ] && [ ! -L "$WEB/storage" ]; then
    echo "Note: $WEB/storage is a real folder, so it was left alone."
    echo "      Move it away and run this script again to show profile photos."
else
    ln -sfn "$REPO/backend/storage/app/public" "$WEB/storage"
fi

# Hostinger's placeholder page would hide the LMS sign-in page.
rm -f "$WEB/default.php"

echo ""
echo "Done. Open your site and check that /up says the application is up."
