#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

database=$(echo "shop crm billing" | cut -d' ' -f $((seed % 3 + 1)))
role="${database}_app"
own=30
imported=$((200 + seed % 100))
first=$((own + 1))
last=$((own + imported))
pg() { su postgres -c "$1"; }

pg "pg_ctl -D $PGDATA -l /var/log/postgresql/postgresql.log -w start" > /dev/null
pg "psql -q -c \"create role $role login\""
pg "createdb -O $role $database"
pg "psql -q -d $database -U $role -c \"create table orders (id serial primary key, customer text not null, total numeric(10, 2) not null, placed_at timestamptz not null default now())\""
# The orders placed here before the move; they took ids 1–$own from the sequence.
pg "psql -q -d $database -U $role -c \"insert into orders (customer, total) select 'customer-' || n, n * 1.5 from generate_series(1, $own) n\""
# Yesterday's move: the old shop's orders kept their ids, so the sequence never moved past them.
pg "psql -q -d $database -U $role -c \"insert into orders (id, customer, total, placed_at) select n, 'legacy-' || n, n * 2.25, now() - interval '400 days' + n * interval '1 hour' from generate_series($first, $last) n\""

mkdir -p /etc/app /var/log/app
printf 'PGDATABASE=%s\nPGUSER=%s\n' "$database" "$role" > /etc/app/db.env
echo "$(date -u +%FT%TZ) import: $imported orders from legacy-shop (ids $first-$last kept), done" >> /var/log/app/import.log

cat > /usr/local/bin/place-order <<SCRIPT
#!/bin/sh
# place-order <customer> <total>: the app's checkout; logs to /var/log/app/orders.log.
. /etc/app/db.env
if out=\$(su postgres -c "psql -qtA -d \$PGDATABASE -U \$PGUSER -c \"insert into orders (customer, total) values ('\$1', \$2) returning id\"" 2>&1); then
  echo "\$(date -u +%FT%TZ) order \$out placed for \$1" >> /var/log/app/orders.log
  echo "\$out"
else
  echo "\$(date -u +%FT%TZ) order failed for \$1: \$out" >> /var/log/app/orders.log
  exit 1
fi
SCRIPT
chmod 0755 /usr/local/bin/place-order

# This morning's customers.
for customer in ana ben chloe; do
  place-order "$customer" 19.90 > /dev/null 2>&1 || true
done
rm -f "$0"
