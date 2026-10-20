#!/bin/sh
# Exit 0 when the nightly dump, unchanged and as the backup user, writes today's dump with every order,
# the password file stays private, and the database still asks the backup role for its password. The
# output is shown to the player: what is wrong, never how.
set -u

database=$(su postgres -c "psql -tA -c \"select datname from pg_database where datname in ('shop', 'tickets', 'billing')\"" 2> /dev/null | head -n 1)
today="/var/backups/postgres/$database-$(date -u +%F).sql.gz"
pgpass=/home/backup/.pgpass

if [ -z "$database" ] || ! su postgres -c "pg_ctl -D $PGDATA status" > /dev/null 2>&1; then
  echo "PostgreSQL is not running"
  exit 1
fi
if ! sha256sum -c /opt/greenbuild/dump.sum > /dev/null 2>&1; then
  echo "the dump job is not the one that shipped"
  exit 1
fi
if grep -vE '^\s*(#|$)' "$PGDATA/pg_hba.conf" | grep -qw trust; then
  echo "the database lets clients in without a password"
  exit 1
fi
rm -f "$today"
if ! su backup -c /usr/local/bin/nightly-dump > /dev/null 2>&1 || ! gzip -dc "$today" 2> /dev/null | grep -q 'COPY public.orders'; then
  echo "the nightly dump still fails"
  exit 1
fi
if [ -n "$(find "$pgpass" -perm /077 2> /dev/null)" ]; then
  echo "the backup password can be read by other users"
  exit 1
fi
echo "the nightly dump works again"
