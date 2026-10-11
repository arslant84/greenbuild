#!/bin/sh
# Exit 0 when the app runs as its own user with a pid file that names it, the backup job still runs,
# and the site serves the app's page. The output is shown to the player: what is wrong, never how.
set -u

pidfile=$(ls /run/*/*.pid 2> /dev/null | head -n 1)
app=$(basename "$(dirname "$pidfile")")
expected=$(cat "/srv/$app/index.html" 2> /dev/null) || { echo "the app's page is missing"; exit 1; }

if ! pgrep -u backup -f nightly-backup > /dev/null; then
  echo "the nightly backup is not running any more"
  exit 1
fi
pid=$(cat "$pidfile" 2> /dev/null)
if [ -z "$pid" ] || ! grep -q '^httpd' "/proc/$pid/cmdline" 2> /dev/null || [ "$(stat -c %U "/proc/$pid")" != "$app" ]; then
  echo "the app's pid file does not name the running app"
  exit 1
fi
if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the app's page"
  exit 1
fi
echo "the site is back"
