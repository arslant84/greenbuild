#!/bin/sh
# Exit 0 when the site serves the app's page through nginx again.
# The output is shown to the player, so it says what is wrong, never how to fix it.
set -u

expected=$(cat /srv/app/www/index.html 2>/dev/null) || { echo "the app's content is missing"; exit 1; }

if ! pgrep -x httpd > /dev/null; then
  echo "the app is not running"
  exit 1
fi

if ! actual=$(wget -q -T 5 -O - http://127.0.0.1/ 2>/dev/null); then
  echo "the site does not answer with 200"
  exit 1
fi

if [ "$actual" != "$expected" ]; then
  echo "the site does not serve the app's page"
  exit 1
fi

echo "the site is back"
