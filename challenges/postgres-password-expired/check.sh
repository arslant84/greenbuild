#!/bin/sh
# Exit 0 when the app connects with its own settings as its own role, a wrong password is still refused,
# and the role's access does not run out again within 30 days. The output is shown to the player: what
# is wrong, never how.
set -u

# shellcheck disable=SC1091
. /etc/app/db.env 2> /dev/null || { echo "the app's database settings are missing"; exit 1; }
# Connects as the app does, with the given password; not exported, so psql run as postgres is unaffected.
as_app() {
  PGHOST=$PGHOST PGPORT=$PGPORT PGDATABASE=$PGDATABASE PGUSER=$PGUSER PGPASSWORD=$1 psql -tA -c "$2"
}
role="${PGDATABASE}_app"

if ! su postgres -c "pg_ctl -D $PGDATA status" > /dev/null 2>&1; then
  echo "PostgreSQL is not running"
  exit 1
fi
if [ "$PGUSER" != "$role" ] || [ "$(as_app "$PGPASSWORD" "select current_user" 2> /dev/null)" != "$role" ]; then
  echo "the app still cannot connect as its own role"
  exit 1
fi
if as_app wrong-password "select 1" > /dev/null 2>&1; then
  echo "the database lets in anyone who knows the app's user name"
  exit 1
fi
lasting=$(su postgres -c "psql -tA -c \"select rolvaliduntil is null or rolvaliduntil > now() + interval '30 days' from pg_roles where rolname = '$role'\"" 2> /dev/null)
if [ "$lasting" != "t" ]; then
  echo "the app's access runs out again within days"
  exit 1
fi
if [ "$(su postgres -c "psql -tA -c \"select rolsuper from pg_roles where rolname = '$role'\"" 2> /dev/null)" != "f" ]; then
  echo "the app's role can do far more than the app needs"
  exit 1
fi
echo "the app is connected again"
