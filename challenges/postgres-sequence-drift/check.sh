#!/bin/sh
# Exit 0 when new orders are placed again with every order kept, the primary key in place, and ids still
# coming from the table's sequence. The output is shown to the player: what is wrong, never how.
set -u

. /etc/app/db.env 2> /dev/null
last=$(sed -n 's/.*(ids [0-9]*-\([0-9]*\) kept).*/\1/p' /var/log/app/import.log 2> /dev/null | tail -n 1)
sql() {
  su postgres -c "psql -qtA -d $PGDATABASE -c \"$1\"" 2> /dev/null
}

if [ -z "$last" ] || ! su postgres -c "pg_ctl -D $PGDATA status" > /dev/null 2>&1; then
  echo "the database is not running"
  exit 1
fi
if [ "$(sql "select count(*) from orders where id <= $last")" != "$last" ]; then
  echo "orders from before or after the move are missing"
  exit 1
fi
if [ "$(sql "select count(*) from pg_constraint where conrelid = 'orders'::regclass and contype = 'p'")" != "1" ]; then
  echo "the orders table lost its primary key"
  exit 1
fi
case "$(sql "select pg_get_expr(adbin, adrelid) from pg_attrdef where adrelid = 'orders'::regclass")" in
  nextval*) ;;
  *) echo "new orders no longer get their ids from the table's sequence"; exit 1 ;;
esac
for customer in check-1 check-2; do
  id=$(place-order "$customer" 9.99 2> /dev/null)
  if [ -z "$id" ] || [ "$id" -le "$last" ]; then
    echo "a new order cannot be placed"
    exit 1
  fi
done
echo "customers can order again"
