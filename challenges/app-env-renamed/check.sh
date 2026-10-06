#!/bin/sh
# Exit 0 when the app starts the official way (appctl, reading its environment file), runs as its
# own user, and the site serves its page through nginx. Any app started by hand is stopped first,
# so the fix must survive a restart. The output is shown to the player: what is wrong, never how.
set -u

. /etc/appctl.conf 2> /dev/null || { echo "the app's configuration is missing"; exit 1; }
expected=$(cat "/srv/$APP/www/index.html" 2> /dev/null) || { echo "the app's page is missing"; exit 1; }

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi

pkill -x httpd 2> /dev/null
sleep 1
if ! appctl start > /dev/null 2>&1; then
  echo "the app does not start with its configuration"
  exit 1
fi
sleep 1

if ps -o user,comm | grep ' httpd$' | grep -q '^root '; then
  echo "the app runs as root"
  exit 1
fi

if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the app's page"
  exit 1
fi

echo "the app is back"
