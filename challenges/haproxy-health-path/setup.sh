#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "shop portal catalog" | cut -d' ' -f $((seed % 3 + 1)))
port_a=$((9000 + seed % 400))
port_b=$((port_a + 1))
www="/srv/$app/www"

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "$www" "/var/log/$app"
# Release 2.0 of the app moved its health endpoint from /health to /healthz (APP-430).
printf '<html><body>%s</body></html>\n' "$app" > "$www/index.html"
printf 'ok\n' > "$www/healthz"
echo "$(date -u +%FT%TZ) APP-430: release 2.0 deployed; the health endpoint is now /healthz (/health is gone)" >> "/var/log/$app/release.log"

cat > "/usr/local/bin/$app-start" <<SCRIPT
#!/bin/sh
# Starts both copies of the $app, as the $app user.
for port in $port_a $port_b; do
  pgrep -f "httpd -p 127.0.0.1:\$port " > /dev/null || su -s /bin/sh $app -c "httpd -p 127.0.0.1:\$port -h $www"
done
SCRIPT
chmod 0755 "/usr/local/bin/$app-start"
"$app-start"

cat > /etc/haproxy/haproxy.cfg <<CFG
global
    user haproxy
    group haproxy

defaults
    mode http
    timeout connect 2s
    timeout client 10s
    timeout server 10s

frontend web
    bind 127.0.0.1:80
    default_backend $app

# The stats page shows each server's state and why.
frontend stats
    bind 127.0.0.1:8404
    stats enable
    stats uri /stats

backend $app
    balance roundrobin
    option httpchk GET /health
    server ${app}1 127.0.0.1:$port_a check inter 1s fall 2 rise 1
    server ${app}2 127.0.0.1:$port_b check inter 1s fall 2 rise 1
CFG

cat > /usr/local/bin/haproxy-reload <<'SCRIPT'
#!/bin/sh
# Checks the configuration and reloads haproxy without dropping connections.
set -e
haproxy -c -q -f /etc/haproxy/haproxy.cfg
haproxy -D -f /etc/haproxy/haproxy.cfg -p /run/haproxy.pid -sf $(cat /run/haproxy.pid 2> /dev/null)
SCRIPT
chmod 0755 /usr/local/bin/haproxy-reload
haproxy -D -f /etc/haproxy/haproxy.cfg -p /run/haproxy.pid
rm -f "$0"
