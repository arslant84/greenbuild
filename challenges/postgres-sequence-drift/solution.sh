#!/bin/sh
# Reference fix used by CI: move the id sequence past the highest id the move brought in.
set -eu

. /etc/app/db.env
su postgres -c "psql -q -d $PGDATABASE -c \"select setval(pg_get_serial_sequence('orders', 'id'), (select max(id) from orders))\"" > /dev/null
