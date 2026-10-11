#!/bin/sh
# Exit 0 when the app's start script would work for the next deploy and the site serves the app's page.
# The output is shown to the player: what is wrong, never how.
set -u

script=$(ls /opt/*/start.sh 2> /dev/null | head -n 1)
app=$(basename "$(dirname "$script")")
if [ -z "$script" ] || [ ! -x "$script" ]; then
  echo "the app's start script is missing or not executable"
  exit 1
fi
if grep -q "$(printf '\r')" "$script"; then
  echo "the next deploy would fail to run the start script just like this one"
  exit 1
fi
if ! pgrep -u "$app" httpd > /dev/null; then
  echo "the app is not running as its own user"
  exit 1
fi
expected=$(cat "/srv/$app/index.html" 2> /dev/null) || { echo "the app's page is missing"; exit 1; }
if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the app's page"
  exit 1
fi
echo "the site is back"
