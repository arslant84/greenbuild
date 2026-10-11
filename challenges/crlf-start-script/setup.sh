#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "billing reports search" | cut -d' ' -f $((seed % 3 + 1)))
port=$((4000 + seed % 1000))
page_token=$(printf 'greenbuild-crlf-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/srv/$app" "/opt/$app" "/var/log/$app"
printf '%s\n' "$page_token" > "/srv/$app/index.html"
chown "$app" "/var/log/$app"

# The release was packed on a Windows build share, so its start script has CRLF line endings.
printf '#!/bin/sh\r\n# Starts %s on 127.0.0.1:%s. Run by the deploy hook as the %s user.\r\nhttpd -p 127.0.0.1:%s -h /srv/%s\r\necho "%s started"\r\n' \
  "$app" "$port" "$app" "$port" "$app" "$app" > "/opt/$app/start.sh"
chmod 0755 "/opt/$app/start.sh"

cat > /etc/nginx/conf.d/site.conf <<CONF
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_connect_timeout 3s;
    }
}
CONF

cat > /var/log/deploy.log <<LOG
$(date -u +%FT%TZ) release $app 2026.10.$((seed % 28 + 1)) unpacked from the Windows build share (build01, releases/$app)
$(date -u +%FT%TZ) running /opt/$app/start.sh as $app
LOG
# The deploy hook: start the app as its user and keep what it says.
su -s /bin/sh "$app" -c "/opt/$app/start.sh" >> "/var/log/$app/start.log" 2>&1 || echo "$(date -u +%FT%TZ) start failed (exit $?)" >> /var/log/deploy.log

nginx
rm -f "$0"
