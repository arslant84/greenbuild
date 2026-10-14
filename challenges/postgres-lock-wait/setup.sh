#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

database=$(echo "ledger billing wallet" | cut -d' ' -f $((seed % 3 + 1)))
account=$((100 + seed % 100))
pg() { su postgres -c "$1"; }

pg "pg_ctl -D $PGDATA -l /var/log/postgresql/postgresql.log -w start" > /dev/null
pg "createdb $database"
pg "psql -q -d $database -c \"create table accounts (id int primary key, balance numeric(12, 2) not null default 0, note text)\""
pg "psql -q -d $database -c \"insert into accounts (id, balance) select n, n * 10 from generate_series(100, 199) n\""
# The server's start, so a restart can be told apart from a fix.
pg "psql -qtA -d $database -c 'select pg_postmaster_start_time()'" > /var/lib/postgresql/started-at
chmod 0444 /var/lib/postgresql/started-at

mkdir -p /etc/app /var/log/app
printf 'PGDATABASE=%s\n' "$database" > /etc/app/db.env
cat > /usr/local/bin/apply-payment <<SCRIPT
#!/bin/sh
# apply-payment <account> <amount>: the payment service's write; gives up after 3 s waiting for a lock.
. /etc/app/db.env
if out=\$(su postgres -c "PGAPPNAME=payments psql -qtA -d \$PGDATABASE -c \"set lock_timeout = '3s'; update accounts set balance = balance + \$2 where id = \$1 returning balance\"" 2>&1); then
  echo "\$(date -u +%FT%TZ) payment of \$2 to account \$1 applied, balance \$out" >> /var/log/app/payments.log
  echo "\$out"
else
  echo "\$(date -u +%FT%TZ) payment of \$2 to account \$1 failed: \$out" >> /var/log/app/payments.log
  exit 1
fi
SCRIPT
chmod 0755 /usr/local/bin/apply-payment

# Last night's reconciliation, run by hand: it updated one account and was never committed. Its session
# stays open, idle in a transaction, holding the row's lock.
nohup sh -c "(printf 'begin;\nupdate accounts set note = %s where id = $account;\n' \"'reconcile 2026-10'\"; exec sleep 2147483647) | su postgres -c 'PGAPPNAME=nightly-reconcile psql -q -d $database'" > /dev/null 2>&1 &
sleep 2

for amount in 25.00 40.00 12.50; do
  apply-payment "$account" "$amount" > /dev/null 2>&1 || true
done
apply-payment $((account == 199 ? 100 : account + 1)) 10.00 > /dev/null 2>&1 || true
rm -f "$0"
