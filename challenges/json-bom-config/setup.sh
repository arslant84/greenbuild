#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "gallery invoices tickets" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8000 + seed % 1000))
page_token=$(printf 'greenbuild-bom-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/opt/$app" "/etc/$app" "/var/log/$app"
chown "$app" "/var/log/$app"

cat > "/opt/$app/app.py" <<PY
"""$app: serves its page and its upload limit, configured in /etc/$app/config.json."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

with open("/etc/$app/config.json", encoding="utf-8") as config_file:
    config = json.load(config_file)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/limits":
            body = json.dumps({"max_upload_mb": config["max_upload_mb"]})
        else:
            body = config["greeting"]
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", config["port"]), Handler).serve_forever()
PY

cat > "/usr/local/bin/$app-start" <<SCRIPT
#!/bin/sh
# Starts $app as its user; its output goes to /var/log/$app/app.log.
su -s /bin/sh $app -c "nohup python3 /opt/$app/app.py >> /var/log/$app/app.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-start"

config() {
  printf '{\n  "port": %s,\n  "greeting": "%s",\n  "max_upload_mb": %s\n}\n' "$port" "$page_token" "$1"
}
config 10 > "/etc/$app/config.json.bak"
# This morning's edit: the new limit, saved by Notepad as "UTF-8 with BOM".
{ printf '\357\273\277'; config 50; } > "/etc/$app/config.json"
chmod 0644 "/etc/$app/config.json" "/etc/$app/config.json.bak"

"$app-start"
sleep 2
rm -f "$0"
