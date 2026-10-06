#!/bin/sh
# Exit 0 when the app keeps its port: after a stop and a pause long enough for anything else to take
# the port, it starts the official way (appctl), stays up as its own user, and the site serves its
# page through nginx. The output is shown to the player: what is wrong, never how.
set -u

. /etc/appctl.conf 2> /dev/null || { echo "the app's configuration is missing"; exit 1; }
expected=$(cat "/srv/$APP/www/index.html" 2> /dev/null) || { echo "the app's page is missing"; exit 1; }

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi

appctl stop > /dev/null 2>&1
sleep 3
appctl start > /dev/null 2>&1
sleep 1
if ! appctl status > /dev/null 2>&1; then
  echo "the app does not stay up after a restart"
  exit 1
fi

if ps -o user,args | grep "httpd .*-h /srv/$APP/www" | grep -v grep | grep -q '^root '; then
  echo "the app runs as root"
  exit 1
fi

if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the app's page"
  exit 1
fi

echo "the app is back"
