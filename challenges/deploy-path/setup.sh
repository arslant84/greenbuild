#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

site=$(echo "shop docs status" | cut -d' ' -f $((seed % 3 + 1)))
release=$((10 + seed % 30))
old_version="2.$((release - 1)).0"
new_version="2.$release.0"
site_root="/srv/$site"
build=$(mktemp -d)

mkdir -p "$site_root/releases/initial" /var/deploy/incoming /var/log/deploy
printf 'SITE_ROOT=%s\n' "$site_root" > /etc/deploy.conf
printf '%s %s\n' "$site" "$old_version" > "$site_root/releases/initial/index.html"
ln -sfn "$site_root/releases/initial" "$site_root/current"

# Tonight's release, as the build pipeline left it.
printf '%s %s %s\n' "$site" "$new_version" "$(printf 'greenbuild-deploy-%s' "$seed" | sha256sum | cut -c1-12)" > "$build/index.html"
tar -czf "/var/deploy/incoming/$site-$new_version.tar.gz" -C "$build" index.html
rm -rf "$build"

cat > "/etc/nginx/conf.d/$site.conf" <<CONF
server {
    listen 80 default_server;
    root $site_root/current;
}
CONF
nginx

# Last night's pipeline run, after OPS-388 changed the deploy script.
{
  echo "$ deploy /var/deploy/incoming/$site-$new_version.tar.gz"
  deploy "/var/deploy/incoming/$site-$new_version.tar.gz" 2>&1 || echo "pipeline: deploy failed with exit code $?"
} > /var/log/deploy/pipeline.log
rm -f "$0"
