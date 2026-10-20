#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "chat tracker auction" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8100 + seed % 800))

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/opt/$app" "/srv/$app/public" "/var/log/$app"
chown "$app:$app" "/var/log/$app"

cat > "/opt/$app/live.py" <<PY
# The $app live feed: a websocket on 127.0.0.1:$port that answers every message.
import asyncio
import logging

from websockets.asyncio.server import serve

logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)


async def feed(websocket):
    async for message in websocket:
        await websocket.send(f"$app: {message}")


async def main():
    async with serve(feed, "127.0.0.1", $port) as server:
        await server.serve_forever()


asyncio.run(main())
PY

cat > "/srv/$app/public/index.html" <<HTML
<!doctype html>
<html><head><title>$app</title></head><body>
<p id="status">connecting…</p>
<script>
const live = new WebSocket("ws://" + location.host + "/live");
live.onopen = () => { document.getElementById("status").textContent = "live"; };
live.onclose = () => { document.getElementById("status").textContent = "reconnecting…"; };
</script>
</body></html>
HTML

cat > "/usr/local/bin/$app-live" <<SCRIPT
#!/bin/sh
# Starts the $app live feed as the $app user, unless it is running.
pgrep -f "python3 /opt/$app/live.py" > /dev/null && exit 0
su -s /bin/sh $app -c "nohup python3 /opt/$app/live.py >> /var/log/$app/live.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-live"
"$app-live"

# PLAT-512: the site moved off the old load balancer; its proxy rules were rewritten by hand.
cat > "/etc/nginx/http.d/$app.conf" <<CONF
server {
    listen 80 default_server;
    root /srv/$app/public;

    location / {
        try_files \$uri /index.html;
    }

    # PLAT-512: the live feed, previously routed by the load balancer.
    location /live {
        proxy_pass http://127.0.0.1:$port;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
CONF
echo "$(date -u +%FT%TZ) PLAT-512: $app moved behind nginx; load balancer rules ported by hand" >> /var/log/nginx/ops.log

mkdir -p /run/nginx
nginx
rm -f "$0"
