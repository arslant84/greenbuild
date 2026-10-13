#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "shop billing status" | cut -d' ' -f $((seed % 3 + 1)))
host="$app.acme.test"
# The app's server_name has had a typo since it was set up; as the only site it answered every request anyway.
case $((seed / 3 % 3)) in
  0) typo="$app.amce.test" ;;
  1) typo="$app.acm.test" ;;
  *) typo="${app}s.acme.test" ;;
esac
app_token=$(printf 'greenbuild-vhost-app-%s' "$seed" | sha256sum | cut -c1-16)
launch_token=$(printf 'greenbuild-vhost-launch-%s' "$seed" | sha256sum | cut -c1-16)

mkdir -p "/srv/$app" /srv/launch "/etc/$app"
printf '%s\n' "$app_token" > "/srv/$app/index.html"
printf '%s\n' "$launch_token" > /srv/launch/index.html
printf 'PUBLIC_URL=http://%s/\nLISTEN=127.0.0.1:8080\n' "$host" > "/etc/$app/app.env"

cat > "/etc/nginx/conf.d/$app.conf" <<CONF
server {
    listen 80;
    server_name $typo;
    root /srv/$app;
    access_log /var/log/nginx/$app.access.log;
}
CONF

cat > /etc/nginx/conf.d/00-launch.conf <<CONF
# Launch page (marketing, ticket MKT-412). Default for every address without its own site, so
# campaign links on any of our domains land here.
server {
    listen 80 default_server;
    server_name launch.acme.test;
    root /srv/launch;
    access_log /var/log/nginx/launch.access.log;
}
CONF

echo "$(date -u +%FT%TZ) deploy: added /etc/nginx/conf.d/00-launch.conf (MKT-412), nginx -t ok, reloaded" >> /var/log/deploy.log
nginx
sleep 1
rm -f "$0"
