#!/bin/bash
# Creates backend/.env for Hostinger by asking a few questions (see HOSTINGER.md).
#
#   bash hostinger/setup-env.sh your-site.hostingersite.com
#
# Passwords are not shown while typing. Run it again to start over.
set -e
cd "$(dirname "$0")/.."

SITE=${1:-}
if [ -z "$SITE" ]; then
    read -r -p "Website address (e.g. lms.example.com): " SITE
fi
SITE=${SITE#https://}; SITE=${SITE#http://}; SITE=${SITE%%/*}

# Hostinger names the database and user "<account>_<name>".
ACCOUNT=$(whoami)
read -r -p "Database name [${ACCOUNT}_siknayan]: " DBN
DBN=${DBN:-${ACCOUNT}_siknayan}
read -r -p "Database username [${ACCOUNT}_siknayan]: " DBU
DBU=${DBU:-${ACCOUNT}_siknayan}
read -r -s -p "Database password (hidden): " DBP; echo
if [ -z "$DBP" ]; then echo "The database password is needed."; exit 1; fi
read -r -s -p "Gmail App Password (hidden, press Enter to skip for now): " MP; echo

if [ -f backend/.env ] && grep -q '^APP_KEY=.\+' backend/.env; then
    KEY=$(grep '^APP_KEY=' backend/.env | head -n 1)
else
    KEY=""
fi

cp backend/.env.hostinger.example backend/.env

SITE="$SITE" DBN="$DBN" DBU="$DBU" DBP="$DBP" MP="$MP" KEY="$KEY" php -r '
$file = "backend/.env";
$text = file_get_contents($file);
// Quote a value so any character in a password is read back as typed.
$quote = function ($v) {
    if (strpos($v, "\x27") === false) return "\x27" . $v . "\x27";
    return "\"" . addcslashes($v, "\"\\") . "\"";
};
$site = getenv("SITE");
$set = [
    "APP_URL" => "https://" . $site,
    "FRONTEND_URL" => "https://" . $site,
    "DB_DATABASE" => getenv("DBN"),
    "DB_USERNAME" => getenv("DBU"),
    "DB_PASSWORD" => $quote(getenv("DBP")),
];
$mail = str_replace(" ", "", (string) getenv("MP"));
// Empty when skipped: the placeholder text would make the file unreadable.
$set["MAIL_PASSWORD"] = $mail;
foreach ($set as $k => $v) {
    $text = preg_replace_callback("/^" . $k . "=.*$/m", fn () => $k . "=" . $v, $text, 1);
}
$key = (string) getenv("KEY");
if ($key !== "") {
    $text = preg_replace_callback("/^APP_KEY=.*$/m", fn () => $key, $text, 1);
}
file_put_contents($file, $text);
'
chmod 600 backend/.env

echo ""
echo "Saved backend/.env for https://$SITE"
echo "  Database: $DBN (user $DBU)"
if [ -z "$MP" ]; then
    echo "  Gmail App Password: not set yet (emails will not send until it is)."
fi
echo ""
echo "Checking the database login..."
if DBN="$DBN" DBU="$DBU" DBP="$DBP" php -r 'try { new PDO("mysql:host=localhost;dbname=".getenv("DBN"), getenv("DBU"), getenv("DBP")); echo "  OK: the database accepts this login.\n"; } catch (Throwable $e) { echo "  PROBLEM: ".$e->getMessage()."\n  Check the names and password in hPanel -> Databases, then run this again.\n"; exit(1); }'; then
    echo ""
    echo "Next: sh hostinger/install.sh ~/domains/$SITE/public_html"
fi
