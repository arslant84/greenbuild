#!/bin/sh
# Exit 0 when PostgreSQL starts from its own data directory as the postgres user and still has the
# restored orders. The output is shown to the player: what is wrong, never how.
set -u

pg() { su postgres -c "$1"; }

if [ ! -d "$PGDATA" ]; then
  echo "the data directory is missing"
  exit 1
fi

pg "pg_ctl -D $PGDATA -m fast -w stop" > /dev/null 2>&1
if ! pg "pg_ctl -D $PGDATA -l /var/log/postgresql/postgresql.log -w -t 10 start" > /dev/null 2>&1; then
  echo "PostgreSQL does not start"
  exit 1
fi

# A fresh cluster has no orders table, so a fix that threw the data away cannot pass.
databases=$(pg "psql -tA -c \"select string_agg(datname, ' ') from pg_database where not datistemplate and datname <> 'postgres'\"" 2> /dev/null)
for database in $databases; do
  if pg "psql -tA -d $database -c 'select token from orders'" 2> /dev/null | grep -q .; then
    echo "the database is back"
    exit 0
  fi
done
echo "the restored orders are missing"
exit 1
