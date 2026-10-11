#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

reporter=$(echo "reports analytics exports" | cut -d' ' -f $((seed % 3 + 1)))
database=$(echo "shop crm billing" | cut -d' ' -f $((seed / 3 % 3 + 1)))
log=/var/log/postgresql/postgresql.log
pg() { su postgres -c "$1"; }

# A small server: 20 connections, 3 of them kept for superusers.
cat >> "$PGDATA/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
max_connections = 20
superuser_reserved_connections = 3
CONF
pg "pg_ctl -D $PGDATA -l $log -w start" > /dev/null
pg "psql -q -c 'create role app login; create role $reporter login'"
pg "createdb -O app $database"

adduser -D -H -s /bin/sh "$reporter"
mkdir -p "/etc/$reporter" "/var/log/$reporter" /var/log/app
chown "$reporter" "/var/log/$reporter"
cat > "/etc/$reporter/worker.env" <<ENV
# Connection pool of the $reporter worker. Each connection waits for report jobs and stays open.
POOL_SIZE=20
DATABASE=$database
ENV
cat > "/usr/local/bin/$reporter-worker" <<SCRIPT
#!/bin/sh
# Keeps a pool of POOL_SIZE connections open for the $reporter jobs; each one reconnects when it is lost.
. /etc/$reporter/worker.env
i=0
while [ "\$i" -lt "\$POOL_SIZE" ]; do
  while true; do
    psql -q -h 127.0.0.1 -U $reporter -d "\$DATABASE" -c "select pg_sleep(86400)" > /dev/null 2>> /var/log/$reporter/worker.log
    echo "\$(date -u +%FT%TZ) connection lost, reconnecting" >> /var/log/$reporter/worker.log
    sleep 1
  done &
  i=\$((i + 1))
done
wait
SCRIPT
chmod 0755 "/usr/local/bin/$reporter-worker"
su -s /bin/sh "$reporter" -c "nohup $reporter-worker > /dev/null 2>&1 &"

# Wait until the pool holds every normal slot, then let the app try. The first look waits: a superuser
# connection takes a normal slot while one is free.
sleep 3
for _ in $(seq 30); do
  [ "$(pg "psql -tA -c \"select count(*) from pg_stat_activity where usename = '$reporter'\"")" -ge 17 ] && break
  sleep 0.5
done
for _ in 1 2 3; do
  psql -h 127.0.0.1 -U app -d "$database" -c 'select 1' 2>&1 | sed "s/^/$(date -u +%FT%TZ) /" >> /var/log/app/app.log || true
done
rm -f "$0"
