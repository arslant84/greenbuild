#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

database=$(echo "orders payroll inventory" | cut -d' ' -f $((seed % 3 + 1)))
role="${database}_app"
password=$(printf 'greenbuild-expired-%s' "$seed" | sha256sum | cut -c1-20)
# The rotation policy's 90 days ran out a few hours ago.
expired_at=$(date -u -d "@$(($(date +%s) - 3600 * (2 + seed % 10)))" '+%F %T+00')
log=/var/log/postgresql/postgresql.log
pg() { su postgres -c "$1"; }

cat >> "$PGDATA/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
password_encryption = 'scram-sha-256'
CONF
cat > "$PGDATA/pg_hba.conf" <<HBA
# TYPE  DATABASE  USER  ADDRESS        METHOD
local   all       postgres             peer
host    all       all   127.0.0.1/32   scram-sha-256
HBA
pg "pg_ctl -D $PGDATA -l $log -w start" > /dev/null
# SEC-1201: application roles are created with a 90-day password, to force rotation.
pg "psql -q -c \"create role $role login password '$password' valid until '$expired_at'\""
pg "createdb -O $role $database"

mkdir -p /etc/app /var/log/app
cat > /etc/app/db.env <<ENV
# How the app reaches its database.
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=$database
PGUSER=$role
PGPASSWORD=$password
ENV
chmod 0600 /etc/app/db.env

# The app's connections since the password ran out.
for attempt in 1 2 3; do
  # shellcheck disable=SC1091
  (. /etc/app/db.env && export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD && psql -c 'select 1' 2>&1 | sed "s/^/$(date -u +%FT%TZ) /") >> /var/log/app/app.log || true
done
rm -f "$0"
