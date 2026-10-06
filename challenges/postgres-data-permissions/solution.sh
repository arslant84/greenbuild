#!/bin/sh
# Reference fix used by CI: give the data directory back to postgres with the mode it requires, then start.
set -eu

chown -R postgres:postgres "$PGDATA"
chmod 0700 "$PGDATA"
su postgres -c "pg_ctl -D $PGDATA -l /var/log/postgresql/postgresql.log -w start"
