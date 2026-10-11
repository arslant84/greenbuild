#!/bin/sh
# Exit 0 when the app's credentials connect over TCP, a wrong password is still refused, and the
# app's data is reachable. The output is shown to the player: what is wrong, never how.
set -u

# shellcheck disable=SC1091
. /etc/app/db.env 2> /dev/null || { echo "the app's database settings are missing"; exit 1; }
export PGHOST PGPORT PGDATABASE PGUSER

if ! su postgres -c "pg_ctl -D $PGDATA status" > /dev/null 2>&1; then
  echo "PostgreSQL is not running"
  exit 1
fi
if [ "$(PGPASSWORD=$PGPASSWORD psql -tA -c 'select current_user' 2> /dev/null)" != "$PGUSER" ]; then
  echo "the app still cannot connect with its own settings"
  exit 1
fi
if PGPASSWORD=wrong-password psql -tA -c 'select 1' > /dev/null 2>&1; then
  echo "the database lets in anyone who knows the app's user name"
  exit 1
fi
echo "the app is connected again"
