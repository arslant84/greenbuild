#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

database=$(echo "shop crm billing" | cut -d' ' -f $((seed % 3 + 1)))
role="${database}_app"
password=$(printf 'greenbuild-hba-%s' "$seed" | sha256sum | cut -c1-20)
log=/var/log/postgresql/postgresql.log
pg() { su postgres -c "$1"; }

cat >> "$PGDATA/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
password_encryption = 'scram-sha-256'
CONF
pg "pg_ctl -D $PGDATA -l $log -w start" > /dev/null
pg "psql -q -c \"create role $role login password '$password'\""
pg "createdb -O $role $database"

mkdir -p /etc/app
cat > /etc/app/db.env <<ENV
# How the app reaches its database.
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=$database
PGUSER=$role
PGPASSWORD=$password
ENV
chmod 0600 /etc/app/db.env

# Last night's hardening (SEC-1182): every TCP connection must use TLS. Nobody checked that this
# server has no certificate.
cat > "$PGDATA/pg_hba.conf" <<HBA
# TYPE   DATABASE  USER      ADDRESS        METHOD
local    all       postgres                 peer
# SEC-1182 hardening: TCP connections only over TLS, everything else refused.
hostssl  all       all       127.0.0.1/32   scram-sha-256
host     all       all       0.0.0.0/0      reject
HBA
pg "pg_ctl -D $PGDATA reload" > /dev/null
sleep 1

# The app's next connections fail.
mkdir -p /var/log/app
for attempt in 1 2 3; do
  # shellcheck disable=SC1091
  (. /etc/app/db.env && export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD && psql -c 'select 1' 2>&1 | sed "s/^/$(date -u +%FT%TZ) /") >> /var/log/app/app.log || true
done
rm -f "$0"
