#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "billing invoicing accounts" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8000 + seed % 1000))

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/opt/$app" "/var/log/$app"
chown "$app" "/var/log/$app"

cat > "/opt/$app/app.py" <<PY
"""$app: /invoice/<order> renders an order's invoice with the company's acme-invoice library."""
from http.server import BaseHTTPRequestHandler, HTTPServer

import acme_invoice


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parts = self.path.strip("/").split("/")
        if len(parts) == 2 and parts[0] == "invoice" and parts[1].isdigit():
            status, body = 200, acme_invoice.render(int(parts[1]))
        else:
            status, body = 404, "not found"
        self.send_response(status)
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", $port), Handler).serve_forever()
PY

cat > "/usr/local/bin/$app-start" <<SCRIPT
#!/bin/sh
# Starts $app as its user on port $port. Output: /var/log/$app/app.log.
su -s /bin/sh $app -c "nohup python3 /opt/$app/app.py >> /var/log/$app/app.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-start"

# Last night's deploy, run as root: --user puts the library under root's own home.
pip install --quiet --user --no-index --find-links /opt/wheels acme-invoice > /dev/null 2>&1
mkdir -p /var/log/deploy
echo "$(date -u +%FT%TZ) deploy: pip install --user --no-index --find-links /opt/wheels acme-invoice: Successfully installed acme-invoice-1.2.0" >> /var/log/deploy/deploy.log
chmod 0700 /root

"$app-start"
sleep 3
rm -f "$0"
