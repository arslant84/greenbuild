#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

service=$(echo "backend orders catalog" | cut -d' ' -f $((seed % 3 + 1)))
service_port=$((4000 + seed % 1000))
stale_ip=$(echo "10.20.0.15 10.20.3.7 172.18.4.21" | cut -d' ' -f $((seed / 3 % 3 + 1)))
page_token=$(printf 'greenbuild-hosts-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$service"
mkdir -p "/srv/$service"
printf '%s\n' "$page_token" > "/srv/$service/index.html"
su -s /bin/sh "$service" -c "httpd -p 127.0.0.1:$service_port -h /srv/$service"

cat > /etc/nginx/conf.d/site.conf <<CONF
# Managed by config management (site role). Local edits are overwritten on the next run.
server {
    listen 80 default_server;

    location / {
        proxy_pass http://$service.internal:$service_port;
        proxy_connect_timeout 3s;
    }
}
CONF

# The migration moved the service to this host, but the old address stayed behind.
# /etc/hosts is the container's own file: append to it in place.
cat >> /etc/hosts <<HOSTS
# $service.internal on node-03 (OPS-412 migration, 2026-10-07)
$stale_ip $service.internal
HOSTS

nginx
rm -f "$0"
