# Every new order is a duplicate

## What was broken

`orders.id` is a `serial`: new rows take the next value of `orders_id_seq`. Thirty orders were placed normally (the sequence reached 30), then yesterday's move inserted the old shop's orders with their own ids (31 to a few hundred) without touching the sequence. Every new order now asks for 31, 32, … and fails with `duplicate key value violates unique constraint "orders_pkey"`; each failure still uses up a number, but the sequence would need hundreds of failed orders to catch up.

## How to find it

- `/var/log/app/orders.log`: `duplicate key value violates unique constraint "orders_pkey"`, `Key (id)=(31) already exists`.
- `/var/log/app/import.log`: the move kept the old ids.
- `select last_value from orders_id_seq;` against `select max(id) from orders;`.

## The fix

```sql
select setval(pg_get_serial_sequence('orders', 'id'), (select max(id) from orders));
```

## What not to do

- Deleting the imported orders or the ones in the way: orders are lost.
- Dropping the primary key: duplicates would be stored and nothing would stop the next collision.
- Hard-coding ids in the app: ids must keep coming from the sequence.
