#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "checkout inventory profiles" | cut -d' ' -f $((seed % 3 + 1)))
port=$((4000 + seed % 1000))
page_token=$(printf 'greenbuild-ipv6-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/srv/$app" "/opt/$app" "/etc/$app"
printf '%s\n' "$page_token" > "/srv/$app/index.html"

# The release's start script reads its settings from /etc/<app>/app.env.
cat > "/opt/$app/start.sh" <<SCRIPT
#!/bin/sh
# Starts $app with the settings in /etc/$app/app.env. Run as the $app user.
. /etc/$app/app.env
exec httpd -p "\$LISTEN_ADDR:\$PORT" -h /srv/$app
SCRIPT
chmod 0755 "/opt/$app/start.sh"

cat > "/opt/$app/CHANGELOG.md" <<LOG
## 2026.10.$((seed % 28 + 1))

- Listen on the IPv6 loopback by default (LISTEN_ADDR=[::1]), as part of the IPv6 readiness work.
- Faster static file responses.

## 2026.09.30

- Settings move to /etc/$app/app.env.
LOG

# The release's installer rewrote the settings with the new default.
cat > "/etc/$app/app.env" <<ENV
# $app settings (written by the 2026.10 installer)
LISTEN_ADDR=[::1]
PORT=$port
ENV

cat > /etc/nginx/conf.d/site.conf <<CONF
# Managed by config management (site role). Local edits are overwritten on the next run.
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_connect_timeout 3s;
    }
}
CONF

su -s /bin/sh "$app" -c "/opt/$app/start.sh"
nginx
rm -f "$0"
