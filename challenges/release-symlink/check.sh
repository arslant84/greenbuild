#!/bin/sh
# Exit 0 when the site's current symlink points at the last release whose build succeeded and nginx
# serves that release's page. The output is shown to the player: what is wrong, never how.
set -u

conf=$(ls /etc/nginx/conf.d/*.conf 2> /dev/null | head -1)
app=$(basename "${conf:-none}" .conf)
base="/srv/$app"
# A release whose build failed has no page, so the last good one is the newest with an index.
good=$(ls -d "$base"/releases/*/ 2> /dev/null | sort | while read -r release; do
  [ -f "$release/index.html" ] && basename "$release"
done | tail -1)
if [ -z "$good" ]; then
  echo "the site's releases are missing"
  exit 1
fi

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi

# Releases are switched by moving one symlink; a copied folder breaks the next deploy and rollback.
if [ ! -L "$base/current" ]; then
  echo "current is no longer a symlink to a release"
  exit 1
fi
if [ "$(readlink -f "$base/current")" != "$base/releases/$good" ]; then
  echo "current does not point at the last release that worked"
  exit 1
fi

if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$(cat "$base/releases/$good/index.html")" ]; then
  echo "the site does not serve the release's page"
  exit 1
fi

echo "the site is back"
