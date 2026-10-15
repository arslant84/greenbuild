#!/bin/sh
# Exit 0 when the app records a new order through its own checkout step, as its own role, with the earlier
# orders kept and the database still asking for a password. The output is shown to the player: what is
# wrong, never how.
set -u

# shellcheck disable=SC1091
. /etc/app/db.env 2> /dev/null || { echo "the app's database settings are missing"; exit 1; }
role="${PGDATABASE}_app"
ref="CHECK-$(date +%s)"
as_postgres() {
  su postgres -c "psql -tA -d $PGDATABASE -c \"$1\"" 2> /dev/null
}

if ! su postgres -c "pg_ctl -D $PGDATA status" > /dev/null 2>&1; then
  echo "PostgreSQL is not running"
  exit 1
fi
if [ "$PGUSER" != "$role" ]; then
  echo "the app no longer uses its own role"
  exit 1
fi
if ! /usr/local/bin/record-order "$ref" 42.00 > /dev/null 2>&1; then
  echo "the app still cannot record orders"
  exit 1
fi
if [ "$(as_postgres "select count(*) from orders where ref = '$ref'")" != "1" ]; then
  echo "the new order is not in the database"
  exit 1
fi
if [ "$(as_postgres "select count(*) from orders where ref like 'ORD-%' and ref not like 'ORD-9%'")" -lt 40 ] 2> /dev/null; then
  echo "earlier orders are missing"
  exit 1
fi
if [ "$(as_postgres "select rolsuper from pg_roles where rolname = '$role'")" != "f" ]; then
  echo "the app's role can do far more than the app needs"
  exit 1
fi
if PGHOST=$PGHOST PGPORT=$PGPORT PGDATABASE=$PGDATABASE PGUSER=$PGUSER PGPASSWORD=wrong-password psql -tA -c 'select 1' > /dev/null 2>&1; then
  echo "the database lets in anyone who knows the app's user name"
  exit 1
fi
echo "orders are recorded again"
