#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

site=$(echo "docs shop portal" | cut -d' ' -f $((seed % 3 + 1)))
deploy_user=$(echo "deploy release ci" | cut -d' ' -f $((seed / 3 % 3 + 1)))
page_token=$(printf 'greenbuild-403-%s' "$seed" | sha256sum | cut -c1-16)
root="/srv/www/$site"

adduser -D -H -s /sbin/nologin "$deploy_user"
mkdir -p "$root"
printf '%s\n' "$page_token" > "$root/index.html"
# The deploy ran with umask 077: only its own user can enter the directory and read the page.
chown -R "$deploy_user:$deploy_user" /srv/www
chmod 0700 "$root"
chmod 0600 "$root/index.html"

cat > /etc/nginx/conf.d/site.conf <<CONF
server {
    listen 80 default_server;
    root $root;
    index index.html;
}
CONF

nginx
rm -f "$0"
