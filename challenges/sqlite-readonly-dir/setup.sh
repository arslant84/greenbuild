#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "notes orders tickets" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8000 + seed % 1000))
data="/var/lib/$app"

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/opt/$app" "/var/log/$app" "$data"
chown "$app" "/var/log/$app" "$data"

cat > "/opt/$app/app.py" <<PY
"""$app: GET / shows how many entries are saved; POST / saves one. Data in $data/$app.db."""
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer

DB = "$data/$app.db"


def connect():
    db = sqlite3.connect(DB)
    db.execute("create table if not exists entries (id integer primary key, saved_at text default current_timestamp)")
    return db


class Handler(BaseHTTPRequestHandler):
    def answer(self, status, body):
        self.send_response(status)
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        with connect() as db:
            count = db.execute("select count(*) from entries").fetchone()[0]
        self.answer(200, f"$app: {count} entries\n")

    def do_POST(self):
        try:
            with connect() as db:
                db.execute("insert into entries default values")
            self.answer(201, "saved\n")
        except sqlite3.Error as error:
            print(f"save failed: {error}", flush=True)
            self.answer(500, "could not save\n")

    def log_message(self, *args):
        pass


HTTPServer(("127.0.0.1", $port), Handler).serve_forever()
PY

cat > "/usr/local/bin/$app-start" <<SCRIPT
#!/bin/sh
# Starts $app as its user; its output goes to /var/log/$app/app.log.
su -s /bin/sh $app -c "nohup python3 /opt/$app/app.py >> /var/log/$app/app.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-start"

# The app's history before the restore.
su -s /bin/sh "$app" -c "python3 -c 'import sqlite3; db = sqlite3.connect(\"$data/$app.db\"); db.execute(\"create table entries (id integer primary key, saved_at text default current_timestamp)\"); db.executemany(\"insert into entries default values\", [()] * $((20 + seed % 30))); db.commit()'"

# Last night's restore, run as root: the database came back with its owner (cp -p), but the restore
# recreated the directory itself, which is now root's.
cp -p "$data/$app.db" "/tmp/$app.db"
rm -rf "$data"
mkdir -m 0755 "$data"
cp -p "/tmp/$app.db" "$data/$app.db"
rm -f "/tmp/$app.db"
echo "$(date -u +%FT%TZ) restore: $data from backup-$(date -u +%F).tar (root), done" >> /var/log/restore.log

"$app-start"
sleep 2
rm -f "$0"
