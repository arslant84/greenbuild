#!/bin/sh
# Exit 0 when nginx serves the deployed page again, with workers that are not root and files that
# not everyone can write. The output is shown to the player, so it says what is wrong, never how.
set -u

root=$(sed -n 's/^ *root \([^;]*\);.*/\1/p' /etc/nginx/conf.d/site.conf 2>/dev/null | head -1)
expected=$(cat "$root/index.html" 2>/dev/null) || { echo "the deployed page is missing"; exit 1; }

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi

if ps -o user,args | grep 'nginx: worker' | grep -v grep | grep -q '^root '; then
  echo "nginx workers run as root"
  exit 1
fi

if [ -n "$(find "$root" -perm -0002 2>/dev/null)" ]; then
  echo "the site's files can be written by everyone"
  exit 1
fi

if ! actual=$(wget -q -T 5 -O - http://127.0.0.1/ 2>/dev/null); then
  echo "the site does not answer with 200"
  exit 1
fi

if [ "$actual" != "$expected" ]; then
  echo "the site does not serve the deployed page"
  exit 1
fi

echo "the site is back"
