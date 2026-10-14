#!/bin/sh
# Reference fix used by CI: end the session that sits idle in a transaction holding the account's lock.
set -eu

. /etc/app/db.env
su postgres -c "psql -q -d $PGDATABASE -c \"select pg_terminate_backend(pid) from pg_stat_activity where state like 'idle in transaction%' and datname = current_database()\"" > /dev/null
sleep 1
