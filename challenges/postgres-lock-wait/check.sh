#!/bin/sh
# Exit 0 when the database has not been restarted, every account is still there, nothing sits idle in a
# transaction holding a lock on the accounts, and payments to the blocked account go through again. The
# output is shown to the player: what is wrong, never how.
set -u

. /etc/app/db.env 2> /dev/null
account=$(sed -n 's/.*payment of [0-9.]* to account \([0-9]*\) failed.*/\1/p' /var/log/app/payments.log 2> /dev/null | head -n 1)
sql() {
  su postgres -c "psql -qtA -d $PGDATABASE -c \"$1\"" 2> /dev/null
}

if [ -z "$account" ] || ! su postgres -c "pg_ctl -D $PGDATA status" > /dev/null 2>&1; then
  echo "the database is not running"
  exit 1
fi
if [ "$(sql 'select pg_postmaster_start_time()')" != "$(cat /var/lib/postgresql/started-at)" ]; then
  echo "the database was restarted"
  exit 1
fi
if [ "$(sql 'select count(*) from accounts')" != "100" ]; then
  echo "accounts are missing"
  exit 1
fi
for amount in 1.00 2.00; do
  if ! apply-payment "$account" "$amount" > /dev/null 2>&1; then
    echo "payments to the account still fail"
    exit 1
  fi
done
if [ "$(sql "select count(*) from pg_stat_activity where state like 'idle in transaction%' and datname = current_database()")" != "0" ]; then
  echo "a session still sits in an unfinished transaction"
  exit 1
fi
echo "payments go through again"
