#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "reports invoices statements" | cut -d' ' -f $((seed % 3 + 1)))
queue_db=$((2 + seed % 3))

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/etc/$app" "/var/log/$app" "/var/lib/$app/done"
chown "$app" "/var/log/$app" "/var/lib/$app/done"

# The web app's settings: where it puts export jobs. It reads them on every request.
cat > "/etc/$app/app.env" <<ENV
# How the $app web app reaches its job queue.
REDIS_HOST=127.0.0.1
REDIS_DB=0
ENV
cat > /usr/local/bin/request-export <<SCRIPT
#!/bin/sh
# request-export <id>: what the $app web app does when a customer asks for an export.
. /etc/$app/app.env
redis-cli -h "\$REDIS_HOST" -n "\$REDIS_DB" RPUSH exports "\$1" > /dev/null && echo "\$(date -u +%FT%TZ) export \$1 queued" >> /var/log/$app/app.log
SCRIPT
chmod 0755 /usr/local/bin/request-export

# The worker: it takes export jobs from the queue and produces each export.
cat > "/etc/$app/worker.env" <<ENV
# OPS-4410: the job queue lives in database $queue_db now; database 1 is the session cache.
REDIS_HOST=127.0.0.1
REDIS_DB=$queue_db
ENV
cat > "/usr/local/bin/$app-worker" <<SCRIPT
#!/bin/sh
# The $app export worker; it reads its settings once, at start. Output: /var/log/$app/worker.log.
. /etc/$app/worker.env
echo "\$(date -u +%FT%TZ) worker listening on database \$REDIS_DB" >> /var/log/$app/worker.log
while true; do
  job=\$(redis-cli -h "\$REDIS_HOST" -n "\$REDIS_DB" --raw BLPOP exports 5 | sed -n 2p)
  [ -n "\$job" ] || continue
  echo "export \$job ready" > "/var/lib/$app/done/\$job.txt"
  echo "\$(date -u +%FT%TZ) export \$job done" >> /var/log/$app/worker.log
done
SCRIPT
chmod 0755 "/usr/local/bin/$app-worker"
cat > "/usr/local/bin/$app-worker-start" <<SCRIPT
#!/bin/sh
# Starts the $app export worker as its user.
su -s /bin/sh $app -c "nohup /usr/local/bin/$app-worker > /dev/null 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-worker-start"

su -s /bin/sh redis -c "redis-server /etc/redis.conf --daemonize yes"
sleep 1
"$app-worker-start"
echo "$(date -u +%FT%TZ) OPS-4410: moved the session cache to database 1 and the job queue to database $queue_db; worker.env updated, worker restarted" >> /var/log/$app/ops.log

# This morning's customers.
for job in EXP-$((1000 + seed % 900)) EXP-$((2000 + seed % 900)) EXP-$((3000 + seed % 900)); do
  request-export "$job"
done
sleep 1
rm -f "$0"
