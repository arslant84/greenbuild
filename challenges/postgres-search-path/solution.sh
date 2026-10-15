#!/bin/sh
# Reference fix used by CI: drop the search path the analytics change set on the app's role by mistake.
# New connections resolve the app's tables to public again.
set -eu

# shellcheck disable=SC1091
. /etc/app/db.env
su postgres -c "psql -q -c \"alter role $PGUSER in database $PGDATABASE reset search_path\""
