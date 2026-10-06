#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "orders billing catalog" | cut -d' ' -f $((seed % 3 + 1)))
app_user=$(echo "svc appsvc runner" | cut -d' ' -f $((seed / 3 % 3 + 1)))
app_port=$((4000 + seed % 1000))
page_token=$(printf 'greenbuild-env-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$app_user"
mkdir -p "/etc/$app" "/srv/$app/www" "/var/log/$app"
printf '%s\n' "$page_token" > "/srv/$app/www/index.html"
printf 'APP=%s\nAPP_USER=%s\nVERSION=2.0.0\n' "$app" "$app_user" > /etc/appctl.conf
# The environment file still uses the setting's 1.x name.
printf 'PORT=%s\nLOG_LEVEL=info\n' "$app_port" > "/etc/$app/$app.env"
cat > "/srv/$app/CHANGELOG.md" <<NOTES
# $app changelog

## 2.0.0

- Settings follow the new naming scheme: \`PORT\` is now \`LISTEN_PORT\`.
- Faster startup.

## 1.9.2

- Security fixes.
NOTES
chown -R "$app_user:$app_user" "/srv/$app" "/var/log/$app"

cat > /etc/nginx/conf.d/site.conf <<CONF
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:$app_port;
    }
}
CONF

# The restart after the upgrade fails; nginx keeps answering.
appctl start > /dev/null 2>&1 || true
nginx
rm -f "$0"
