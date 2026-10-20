#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "ingest mailer billing" | cut -d' ' -f $((seed % 3 + 1)))
keep=$((5 + seed % 10))
logs="/var/log/$app"

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "$logs"
chown "$app:$app" "$logs"

cat > "/usr/local/bin/$app" <<SCRIPT
#!/bin/sh
# The $app worker: logs every batch it processes.
batch=0
while :; do
  batch=\$((batch + 1))
  echo "\$(date -u +%FT%TZ) processed batch \$batch" >> $logs/$app.log 2> /dev/null
  sleep 1
done
SCRIPT
chmod 0755 "/usr/local/bin/$app"

cat > "/usr/local/bin/$app-start" <<SCRIPT
#!/bin/sh
# Starts the $app worker as the $app user, unless it is running.
pgrep -f "/usr/local/bin/$app\\$" > /dev/null && exit 0
su -s /bin/sh $app -c "nohup /usr/local/bin/$app > /dev/null 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-start"
"$app-start"
sleep 2

# OPS-977: log rotation for the $app, copied from the web server's template.
cat > "/etc/logrotate.d/$app" <<CONF
$logs/$app.log {
    daily
    rotate $keep
    missingok
    notifempty
    create 0640 root root
}
CONF
# Last night's rotation.
logrotate -f "/etc/logrotate.d/$app"
echo "$(date -u +%FT%TZ) OPS-977: added log rotation for $app (from the nginx template)" >> /var/log/ops.log
rm -f "$0"
