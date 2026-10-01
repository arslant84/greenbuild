#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app_user=$(echo "svc webapp runner" | cut -d' ' -f $((seed % 3 + 1)))
app_port=$((3000 + seed % 1000))
# An offset of 1..998 from the app port, so nginx never points at the right one by chance.
nginx_upstream_port=$((3000 + (seed % 1000 + 1 + seed / 3 % 998) % 1000))
page_token=$(printf 'greenbuild-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$app_user"
mkdir -p /srv/app/www /var/log/app
printf 'PORT=%s\n' "$app_port" > /srv/app/app.env
printf '%s\n' "$page_token" > /srv/app/www/index.html
chown -R "$app_user:$app_user" /srv/app /var/log/app

cat > /etc/nginx/conf.d/site.conf <<EOF
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:${nginx_upstream_port};
    }
}
EOF

/usr/local/bin/start-app
nginx
rm -f "$0"
