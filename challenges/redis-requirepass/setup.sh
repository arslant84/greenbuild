#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "catalog booking survey" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8000 + seed % 1000))
password=$(printf 'greenbuild-redis-%s' "$seed" | sha256sum | cut -c1-24)

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/opt/$app" "/etc/$app" "/var/log/$app"
chown "$app" "/var/log/$app"

cat > "/opt/$app/app.py" <<'PY'
"""Every page counts its visits in Redis. Settings: app.env next to the app's /etc folder (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD)."""
import os
import socket
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

NAME = os.path.basename(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1])
with open(f"/etc/{NAME}/app.env") as env:
    settings = dict(line.strip().split("=", 1) for line in env if "=" in line and not line.startswith("#"))


def encode(parts):
    return f"*{len(parts)}\r\n".encode() + b"".join(f"${len(str(part))}\r\n{part}\r\n".encode() for part in parts)


def redis(*command):
    commands = ([("AUTH", settings["REDIS_PASSWORD"])] if settings.get("REDIS_PASSWORD") else []) + [command]
    with socket.create_connection((settings["REDIS_HOST"], int(settings["REDIS_PORT"])), timeout=3) as conn:
        conn.sendall(b"".join(encode(parts) for parts in commands))
        replies = conn.recv(4096).decode().split("\r\n")
    errors = [reply for reply in replies if reply.startswith("-")]
    if errors:
        raise RuntimeError(errors[0][1:])
    return replies[-2].lstrip(":")


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            visits = redis("INCR", "visits:" + self.path)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(f"{NAME} {self.path}: {visits} visits\n".encode())
        except Exception as error:
            print(f"cache error: {error}", flush=True)
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"cache unavailable\n")

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
PY

cat > "/etc/$app/app.env" <<ENV
# How $app reaches its cache.
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
ENV
chown "$app" "/etc/$app/app.env"
chmod 0644 "/etc/$app/app.env"

cat > "/usr/local/bin/$app-start" <<SCRIPT
#!/bin/sh
# Starts $app as its user on port $port; it reads its settings once, at start. Output: /var/log/$app/app.log.
su -s /bin/sh $app -c "nohup python3 /opt/$app/app.py $port >> /var/log/$app/app.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-start"

# Last night's hardening (SEC-1190): the cache asks for a password.
printf '\n# SEC-1190: clients must authenticate.\nrequirepass %s\n' "$password" >> /etc/redis.conf
su -s /bin/sh redis -c "redis-server /etc/redis.conf --daemonize yes"
sleep 1

"$app-start"
sleep 2
for page in / /about /pricing; do
  wget -q -T 5 -O /dev/null "http://127.0.0.1:$port$page" 2> /dev/null || true
done
rm -f "$0"
