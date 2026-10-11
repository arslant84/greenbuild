#!/bin/sh
# Exit 0 when the reporting worker still runs with at least one connection and, after it has had time
# to reopen what it lost, the app can still connect. The output is shown to the player: what is
# wrong, never how.
set -u

env_file=$(ls /etc/*/worker.env 2> /dev/null | head -n 1)
reporter=$(basename "$(dirname "$env_file")")
database=$(sed -n 's/^DATABASE=//p' "$env_file" 2> /dev/null)
count() {
  su postgres -c "psql -tA -c \"select count(*) from pg_stat_activity where usename = '$1'\"" 2> /dev/null
}

if ! su postgres -c "pg_ctl -D $PGDATA status" > /dev/null 2>&1; then
  echo "PostgreSQL is not running"
  exit 1
fi
if ! pgrep -u "$reporter" -f "$reporter-worker" > /dev/null; then
  echo "the reporting worker is not running"
  exit 1
fi
# The worker reopens lost connections within a few seconds; a fix that only closed them would not last.
sleep 6
if [ "$(count "$reporter")" -lt 1 ]; then
  echo "the reporting worker has no connection to the database"
  exit 1
fi
for _ in 1 2 3; do
  if ! psql -h 127.0.0.1 -U app -d "$database" -tA -c 'select 1' > /dev/null 2>&1; then
    echo "the app still cannot connect"
    exit 1
  fi
done
echo "the app connects again"
