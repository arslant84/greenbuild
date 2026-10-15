#!/bin/sh
# Exit 0 when the app records a new order through its own checkout step into its own table, its queries
# reach its own tables again, and the analytics team keeps its schema and settings. The output is shown to
# the player: what is wrong, never how.
set -u

# shellcheck disable=SC1091
. /etc/app/db.env 2> /dev/null || { echo "the app's database settings are missing"; exit 1; }
role="${PGDATABASE}_app"
analytics="${PGDATABASE}_analytics"
ref="CHECK-$(date +%s)"
as_postgres() {
  su postgres -c "psql -tA -d $PGDATABASE -c \"$1\"" 2> /dev/null
}
as_app() {
  PGHOST=$PGHOST PGPORT=$PGPORT PGDATABASE=$PGDATABASE PGUSER=$PGUSER PGPASSWORD=$PGPASSWORD psql -tA -c "$1" 2> /dev/null
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
if [ "$(as_postgres "select count(*) from public.orders where ref = '$ref'")" != "1" ]; then
  echo "the new order is not in the app's orders table"
  exit 1
fi
if [ "$(as_postgres "select count(*) from public.orders where ref like 'ORD-%' and ref not like 'ORD-9%'")" -lt 40 ] 2> /dev/null; then
  echo "earlier orders are missing"
  exit 1
fi
if [ "$(as_app "select relnamespace::regnamespace from pg_class where oid = to_regclass('orders')")" != "public" ]; then
  echo "the app's queries still reach a table that is not its own"
  exit 1
fi
if [ "$(as_postgres "select count(*) from reporting.orders")" != "7" ]; then
  echo "the analytics team's daily summary is gone or changed"
  exit 1
fi
if [ "$(as_postgres "select has_table_privilege('public', 'reporting.orders', 'select') and has_schema_privilege('public', 'reporting', 'usage')")" != "t" ]; then
  echo "the dashboards can no longer read the analytics team's daily summary"
  exit 1
fi
if ! as_postgres "select setconfig::text from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = '$analytics'" | grep -q 'search_path=reporting, public'; then
  echo "the analytics team's change was undone"
  exit 1
fi
echo "orders are recorded again"
