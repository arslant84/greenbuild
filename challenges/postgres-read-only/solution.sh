#!/bin/sh
# Reference fix used by CI: lift the write freeze at both levels it was set, the database and the app's
# role in it. New connections pick the settings up.
set -eu

# shellcheck disable=SC1091
. /etc/app/db.env
su postgres -c "psql -q -c \"alter database $PGDATABASE reset default_transaction_read_only\""
su postgres -c "psql -q -c \"alter role $PGUSER in database $PGDATABASE reset default_transaction_read_only\""
