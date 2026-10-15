#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

database=$(echo "shop tickets billing" | cut -d' ' -f $((seed % 3 + 1)))
role="${database}_app"
password=$(printf 'greenbuild-readonly-%s' "$seed" | sha256sum | cut -c1-20)
orders=$((40 + seed % 50))
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
pg "psql -q -c \"create role $role login password '$password'\""
pg "createdb -O $role $database"
pg "psql -q -d $database -c \"create table orders (id serial primary key, ref text not null unique, amount numeric(10, 2) not null, created_at timestamptz not null default now())\""
pg "psql -q -d $database -c \"alter table orders owner to $role\""
pg "psql -q -d $database -c \"alter sequence orders_id_seq owner to $role\""
pg "psql -q -d $database -c \"insert into orders (ref, amount) select 'ORD-' || n, n * 3.5 from generate_series(1, $orders) n\""

mkdir -p /etc/app /var/log/app /var/log/dba
cat > /etc/app/db.env <<ENV
# How the app reaches its database.
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=$database
PGUSER=$role
PGPASSWORD=$password
ENV
chmod 0600 /etc/app/db.env

cat > /usr/local/bin/record-order <<'SCRIPT'
#!/bin/sh
# record-order <ref> <amount>: the app's checkout step; each run opens its own connection.
. /etc/app/db.env
export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD
if out=$(psql -qtA -c "insert into orders (ref, amount) values ('$1', $2) returning id" 2>&1); then
  echo "$(date -u +%FT%TZ) order $1 recorded as $out" >> /var/log/app/app.log
  echo "$out"
else
  echo "$(date -u +%FT%TZ) order $1 failed: $out" >> /var/log/app/app.log
  exit 1
fi
SCRIPT
chmod 0755 /usr/local/bin/record-order

# Last night's disk move (OPS-3307): writes were frozen at the database, and, from an older runbook step,
# for the app's role in it. Nobody unfroze them.
pg "psql -q -c \"alter database $database set default_transaction_read_only = on\""
pg "psql -q -c \"alter role $role in database $database set default_transaction_read_only = on\""
echo "$(date -u +%FT%TZ) OPS-3307: froze writes on $database (alter database ... set default_transaction_read_only = on) for the disk move" >> /var/log/dba/maintenance.log
echo "$(date -u +%FT%TZ) OPS-3307: disk move done, $database back on the new volume" >> /var/log/dba/maintenance.log

for ref in ORD-9001 ORD-9002 ORD-9003; do
  record-order "$ref" 19.90 > /dev/null 2>&1 || true
done
rm -f "$0"
