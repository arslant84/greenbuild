#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "shop forum tickets" | cut -d' ' -f $((seed % 3 + 1)))
data_dir=$(echo "/srv/cache-data /data/redis /var/lib/cache-volume" | cut -d' ' -f $((seed / 3 % 3 + 1)))
port=$((8000 + seed % 1000))

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/opt/$app" "/var/log/$app"
chown "$app" "/var/log/$app"

cat > "/opt/$app/app.py" <<'PY'
"""Every page counts its visits in the Redis cache on 127.0.0.1:6379."""
import os
import socket
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

NAME = os.path.basename(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1])


def redis(*parts):
    request = f"*{len(parts)}\r\n".encode() + b"".join(f"${len(str(part))}\r\n{part}\r\n".encode() for part in parts)
    with socket.create_connection(("127.0.0.1", 6379), timeout=3) as conn:
        conn.sendall(request)
        # The reply is one line; it may arrive in several packets.
        received = b""
        while b"\r\n" not in received:
            chunk = conn.recv(4096)
            if not chunk:
                break
            received += chunk
    reply = received.decode().split("\r\n")[0]
    if reply.startswith("-"):
        raise RuntimeError(reply[1:])
    return reply.lstrip(":")


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

cat > "/usr/local/bin/$app-start" <<SCRIPT
#!/bin/sh
# Starts $app as its user on port $port. Output: /var/log/$app/app.log.
su -s /bin/sh $app -c "nohup python3 /opt/$app/app.py $port >> /var/log/$app/app.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-start"

# Last night's move of the cache's data to the new volume (OPS-2231): the directory was made by root.
mkdir -p "$data_dir"
chmod 0755 "$data_dir"
printf '\n# OPS-2231: snapshots live on the new volume.\ndir %s\nsave 60 1\n' "$data_dir" >> /etc/redis.conf
su -s /bin/sh redis -c "redis-server /etc/redis.conf --daemonize yes"
sleep 1

"$app-start"
sleep 2
for page in / /about /pricing; do
  wget -q -T 5 -O /dev/null "http://127.0.0.1:$port$page" 2> /dev/null || true
done
# The migration's first snapshot; it fails, and from then on Redis refuses writes.
redis-cli bgsave > /dev/null
sleep 1
for page in / /pricing; do
  wget -q -T 5 -O /dev/null "http://127.0.0.1:$port$page" 2> /dev/null || true
done
rm -f "$0"
