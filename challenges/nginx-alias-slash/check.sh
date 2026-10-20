#!/bin/sh
# Exit 0 when the site's page and its assets load, the assets come from the current release (a file the
# check adds there is served at once), and nothing outside the assets directory can be reached through
# /assets. The output is shown to the player: what is wrong, never how.
set -u

site=$(ls /srv | grep -E '^(storefront|dashboard|docs)$' | head -n 1)
base="/srv/$site"
assets="$base/current/build/assets"
probe="check-$(date +%s).txt"

status() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1$1"
}

if [ -z "$site" ] || ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
if [ "$(status /)" != "200" ]; then
  echo "the site's page does not load"
  exit 1
fi
for asset in $(grep -oE '/assets/[^"]+' "$base/public/index.html"); do
  if [ "$(status "$asset")" != "200" ]; then
    echo "the page's styles and scripts still fail to load"
    exit 1
  fi
done
echo "probe" > "$assets/$probe"
served=$(curl -s --max-time 5 "http://127.0.0.1/assets/$probe")
rm -f "$assets/$probe"
if [ "$served" != "probe" ]; then
  echo "the assets are not served from the current release"
  exit 1
fi
if curl -s --max-time 5 --path-as-is "http://127.0.0.1/assets../.env" | grep -q DATABASE_URL; then
  echo "files next to the assets can be downloaded"
  exit 1
fi
echo "the site's assets load again"
