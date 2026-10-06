#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

database=$(echo "shop crm billing" | cut -d' ' -f $((seed % 3 + 1)))
order_token=$(printf 'greenbuild-pg-%s' "$seed" | sha256sum | cut -c1-16)
log=/var/log/postgresql/postgresql.log
pg() { su postgres -c "$1"; }

pg "pg_ctl -D $PGDATA -l $log -w start" > /dev/null
pg "createdb $database"
pg "psql -q -d $database -c \"create table orders (id serial primary key, token text not null); insert into orders (token) values ('$order_token');\""
pg "pg_ctl -D $PGDATA -m fast -w stop" > /dev/null

# Last night's restore unpacked the backup as root and without its owners or modes.
chown -R root:root "$PGDATA"
chmod 0755 "$PGDATA"
cat > /root/restore.log <<LOG
restoring the $database cluster from backup-nightly.tar.gz into $PGDATA
extracted with: tar -xzf backup-nightly.tar.gz --no-same-owner --no-same-permissions
done
LOG

# The start after the restore fails.
pg "pg_ctl -D $PGDATA -l $log -w start" > /dev/null 2>&1 || true
rm -f "$0"
