#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

database=$(echo "shop tickets billing" | cut -d' ' -f $((seed % 3 + 1)))
role="${database}_backup"
password=$(printf 'greenbuild-pgpass-%s' "$seed" | sha256sum | cut -c1-20)
orders=$((40 + seed % 50))
log=/var/log/postgresql/postgresql.log
pg() { su postgres -c "$1"; }

cat >> "$PGDATA/postgresql.conf" <<CONF
listen_addresses = '127.0.0.1'
password_encryption = 'scram-sha-256'
CONF
cat > "$PGDATA/pg_hba.conf" <<HBA
# TYPE  DATABASE  USER  ADDRESS        METHOD
local   all       postgres             peer
host    all       all   127.0.0.1/32   scram-sha-256
HBA
pg "pg_ctl -D $PGDATA -l $log -w start" > /dev/null
pg "createdb $database"
pg "psql -q -d $database -c \"create table orders (id serial primary key, ref text not null, amount numeric(10, 2) not null)\""
pg "psql -q -d $database -c \"insert into orders (ref, amount) select 'ORD-' || n, n * 3.5 from generate_series(1, $orders) n\""
pg "psql -q -c \"create role $role login password '$password'\""
pg "psql -q -d $database -c \"grant select on all tables in schema public to $role\""
pg "psql -q -d $database -c \"grant select on all sequences in schema public to $role\""

# The backup account runs the nightly dump; its password lives in ~/.pgpass, as libpq expects.
adduser -D -s /bin/sh backup
mkdir -p /var/backups/postgres /var/log/backup
printf 'localhost:5432:%s:%s:%s\n' "$database" "$role" "$password" > /home/backup/.pgpass
cat > /usr/local/bin/nightly-dump <<SCRIPT
#!/bin/sh
# nightly-dump: dumps the $database database, as the backup user, without asking for a password.
set -o pipefail
target=/var/backups/postgres/$database-\$(date -u +%F).sql.gz
if out=\$(pg_dump --no-password -h 127.0.0.1 -U $role $database 2>&1 > /tmp/dump.sql) && gzip -c /tmp/dump.sql > "\$target"; then
  echo "\$(date -u +%FT%TZ) dumped \$target" >> /var/log/backup/dump.log
else
  echo "\$(date -u +%FT%TZ) dump failed: \$out" >> /var/log/backup/dump.log
  exit 1
fi
rm -f /tmp/dump.sql
SCRIPT
chmod 0755 /usr/local/bin/nightly-dump
chown -R backup:backup /home/backup /var/backups/postgres /var/log/backup
# CFG-718: the new configuration management run wrote the file with its default mode.
chmod 0644 /home/backup/.pgpass
echo "$(date -u +%FT%TZ) CFG-718: backup user's files now deployed by configuration management" >> /var/log/backup/ops.log

# Only the check reads this: the dump job as shipped.
sha256sum /usr/local/bin/nightly-dump > /opt/greenbuild/dump.sum

for _ in 1 2; do
  su backup -c /usr/local/bin/nightly-dump > /dev/null 2>&1 || true
done
rm -f "$0"
