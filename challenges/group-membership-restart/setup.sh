#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "gallery avatars attachments" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8100 + seed % 800))
uploads=/srv/media/uploads

addgroup -S media
adduser -D -H -s /sbin/nologin thumbs
addgroup thumbs media
adduser -D -H -s /sbin/nologin "$app"
mkdir -p "$uploads" "/opt/$app" "/var/log/$app"
chown thumbs:media "$uploads"
# The thumbnailer owns the shared directory; new files inherit its group.
su -s /bin/sh thumbs -c "chmod 2775 $uploads"
chown "$app:$app" "/var/log/$app"

cat > "/opt/$app/upload.py" <<PY
# The $app upload service: stores every PUT /<name> in the shared uploads directory.
import http.server
import os

UPLOADS = "$uploads"


class Upload(http.server.BaseHTTPRequestHandler):
    def do_PUT(self):
        name = os.path.basename(self.path)
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        try:
            with open(os.path.join(UPLOADS, name), "wb") as upload:
                upload.write(body)
        except OSError as error:
            self.log_message("upload %s failed: %s", name, error)
            self.send_response(500)
            self.end_headers()
            return
        self.send_response(201)
        self.end_headers()


http.server.HTTPServer(("127.0.0.1", $port), Upload).serve_forever()
PY

cat > "/usr/local/bin/$app-upload" <<SCRIPT
#!/bin/sh
# Starts or restarts the $app upload service on 127.0.0.1:$port, as the $app user.
case "\${1:-start}" in
  restart) pkill -u $app -f "/opt/$app/upload.py" ; sleep 1 ;;
  start) ;;
  *) echo "usage: $app-upload [start|restart]" >&2; exit 2 ;;
esac
pgrep -u $app -f "/opt/$app/upload.py" > /dev/null && exit 0
su -s /bin/sh $app -c "nohup python3 /opt/$app/upload.py >> /var/log/$app/upload.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-upload"
"$app-upload" start
sleep 1

upload() {
  curl -s -o /dev/null -X PUT --data-binary "photo $1" "http://127.0.0.1:$port/$1.jpg" || true
}
upload "first-$seed"
upload "second-$seed"
# OPS-318: uploads fail with Permission denied; the service's user joins the media group.
addgroup "$app" media
echo "$(date -u +%FT%TZ) OPS-318: $app uploads fail with Permission denied on $uploads; added $app to group media" >> /var/log/ops.log
upload "third-$seed"
rm -f "$0"
