#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "ledger mailer tracker" | cut -d' ' -f $((seed % 3 + 1)))
port=$((4000 + seed % 1000))
page_token=$(printf 'greenbuild-pid-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$app"
adduser -D -H -s /sbin/nologin backup
mkdir -p "/srv/$app" "/run/$app" "/var/log/$app"
printf '%s\n' "$page_token" > "/srv/$app/index.html"
chown "$app" "/run/$app" "/var/log/$app"

# The app's control script, as its package installs it.
cat > /usr/local/bin/appctl <<SCRIPT
#!/bin/sh
# appctl start|status: controls $app. The pid file tells whether it runs.
pidfile=/run/$app/$app.pid
case "\${1:-}" in
  start)
    if [ -f "\$pidfile" ] && kill -0 "\$(cat "\$pidfile")" 2> /dev/null; then
      echo "$app is already running (pid \$(cat "\$pidfile"))" | tee -a /var/log/$app/appctl.log
      exit 1
    fi
    su -s /bin/sh $app -c "httpd -f -p 127.0.0.1:$port -h /srv/$app > /dev/null 2>&1 & echo \\\$! > \$pidfile"
    echo "$app started" | tee -a /var/log/$app/appctl.log
    ;;
  status)
    if [ -f "\$pidfile" ] && kill -0 "\$(cat "\$pidfile")" 2> /dev/null; then echo "$app is running (pid \$(cat "\$pidfile"))"; else echo "$app is stopped"; fi
    ;;
  *)
    echo "usage: appctl start|status" >&2
    exit 2
    ;;
esac
SCRIPT
chmod 0755 /usr/local/bin/appctl

cat > /usr/local/bin/nightly-backup <<'SCRIPT'
#!/bin/sh
# Copies the day's data to the backup share; runs for hours.
while true; do sleep 60; done
SCRIPT
chmod 0755 /usr/local/bin/nightly-backup

cat > /etc/nginx/conf.d/site.conf <<CONF
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_connect_timeout 3s;
    }
}
CONF

appctl start > /dev/null
# Overnight the app was killed without a chance to remove its pid file, and the backup job that
# started later got the same process id.
kill -9 "$(cat "/run/$app/$app.pid")"
echo "$(date -u +%FT%TZ) $app: Killed (signal 9), out of memory" >> "/var/log/$app/crash.log"
su -s /bin/sh backup -c "nohup nightly-backup > /dev/null 2>&1 & echo \$! > /tmp/backup.pid"
pgrep -u backup -f nightly-backup > "/run/$app/$app.pid"
rm -f /tmp/backup.pid
appctl start > /dev/null || true

nginx
rm -f "$0"
