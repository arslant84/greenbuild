#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

port=$((8000 + seed % 1000))
report_seconds=$((8 + seed % 5))
home_token=$(printf 'greenbuild-gw-home-%s' "$seed" | sha256sum | cut -c1-16)
report_token=$(printf 'greenbuild-gw-report-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin finance
mkdir -p /opt/finance /var/log/finance
chown finance /var/log/finance

cat > /opt/finance/app.py <<PY
"""finance: the home page, and /report/monthly, which takes about $report_seconds s to build."""
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/report/monthly":
            time.sleep($report_seconds)
            body = "$report_token"
        else:
            body = "$home_token"
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *args):
        pass


ThreadingHTTPServer(("127.0.0.1", $port), Handler).serve_forever()
PY
su -s /bin/sh finance -c "nohup python3 /opt/finance/app.py >> /var/log/finance/app.log 2>&1 &"

cat > /etc/nginx/http.d/finance.conf <<CONF
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_connect_timeout 2s;
        # Platform default (OPS-77): fail fast instead of holding a worker for a stuck upstream.
        proxy_read_timeout 5s;
    }
}
CONF
nginx
sleep 1
# Finance's tries this morning.
for try in 1 2; do
  wget -q -T 20 -O /dev/null http://127.0.0.1/report/monthly 2> /dev/null || true
done
rm -f "$0"
