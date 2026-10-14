#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

site=$(echo "shop store market" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8000 + seed % 1000))
login_token=$(printf 'greenbuild-host-login-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$site"
mkdir -p "/opt/$site" "/var/log/$site"
chown "$site" "/var/log/$site"

cat > "/opt/$site/app.py" <<PY
"""$site: /account asks a visitor without a session to sign in, linking to the sign-in page on the address
they used (the same absolute link goes into emails, so it is built from the request's Host)."""
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        host = self.headers.get("Host", "")
        if self.path == "/account":
            body = f'<p>Please sign in to see your orders.</p><a id="sign-in" href="http://{host}/login?next=/account">Sign in</a>'
        elif self.path.startswith("/login"):
            body = "$login_token"
        else:
            body = "$site home"
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", $port), Handler).serve_forever()
PY
su -s /bin/sh "$site" -c "nohup python3 /opt/$site/app.py >> /var/log/$site/app.log 2>&1 &"

cat > "/etc/nginx/http.d/$site.conf" <<CONF
# The shop behind the new edge (INFRA-301), under both of its names.
server {
    listen 80 default_server;
    server_name $site.acme.test www.$site.acme.test;

    location / {
        proxy_pass http://127.0.0.1:$port;
    }
}
CONF
nginx
sleep 2
rm -f "$0"
