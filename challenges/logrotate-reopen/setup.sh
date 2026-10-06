#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

site=$(echo "shop news portal" | cut -d' ' -f $((seed % 3 + 1)))
page_token=$(printf 'greenbuild-logs-%s' "$seed" | sha256sum | cut -c1-16)

mkdir -p "/srv/$site"
printf '%s %s\n' "$site" "$page_token" > "/srv/$site/index.html"
cat > "/etc/nginx/conf.d/$site.conf" <<CONF
server {
    listen 80 default_server;
    root /srv/$site;
}
CONF

# Yesterday's rotation: it renames the logs, but nothing tells nginx to reopen them.
cat > /etc/logrotate.d/nginx <<CONF
/var/log/nginx/*.log {
    daily
    rotate 14
    nodateext
    compress
    delaycompress
    missingok
    notifempty
    create 0640 nginx adm
}
CONF

nginx
visit() {
  for page in / /products /about /contact; do
    wget -q -O /dev/null "http://127.0.0.1$page" 2> /dev/null || true
  done
}
visit
logrotate -f /etc/logrotate.conf
# Since the rotation, every visit lands in the renamed file.
visit
rm -f "$0"
