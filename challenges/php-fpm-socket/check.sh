#!/bin/sh
# Exit 0 when, after PHP-FPM restarts from its configuration and nginx reloads, the site serves the
# page PHP computes, the socket is not open to every user, and neither server works as root. The
# output is shown to the player: what is wrong, never how.
set -u

pool=$(ls /etc/php84/php-fpm.d/*.conf 2> /dev/null | head -1)
app=$(basename "${pool:-none}" .conf)
page_seed=$(sed -n 's/.*hash("sha256", "\([^"]*\)").*/\1/p' "/srv/$app/index.php" 2> /dev/null)
if [ -z "$page_seed" ]; then
  echo "the app's page is missing"
  exit 1
fi
expected=$(printf '%s' "$page_seed" | sha256sum | cut -d' ' -f1)
socket="/run/php-fpm/$app.sock"

if [ -f /run/php-fpm/php-fpm.pid ]; then
  kill "$(cat /run/php-fpm/php-fpm.pid)" 2> /dev/null
  sleep 1
fi
if ! php-fpm84 > /dev/null 2>&1 || [ ! -S "$socket" ]; then
  echo "PHP-FPM does not start from its configuration"
  exit 1
fi
if ! pgrep -f 'nginx: master' > /dev/null || ! nginx -s reload > /dev/null 2>&1; then
  echo "nginx is not running"
  exit 1
fi
sleep 1

# The last digit of the mode is what every other user may do.
case "$(stat -c %a "$socket")" in
  *[2367]) echo "the app's socket is open to every user"; exit 1 ;;
esac
if ps -o user,args | grep -E 'nginx: worker|php-fpm: pool' | grep -v grep | grep -q '^root '; then
  echo "a web server process runs as root"
  exit 1
fi

if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the app's page"
  exit 1
fi

echo "the site is back"
