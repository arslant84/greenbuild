# Frozen after the move

## What was broken

For last night's disk move (OPS-3307), the DBA froze writes with `ALTER DATABASE <db> SET default_transaction_read_only = on`, and an older runbook step had set the same for the app's role in that database (`ALTER ROLE <role> IN DATABASE <db> SET …`). Nobody unfroze them. Every new connection starts read-only, so the app's checkout fails with `cannot execute INSERT in a read-only transaction`, while reads work.

## How to find it

- `/var/log/app/app.log`: `ERROR: cannot execute INSERT in a read-only transaction`.
- `/var/log/dba/maintenance.log`: the freeze, and no unfreeze.
- As the app: `SHOW default_transaction_read_only;` answers `on`. As postgres: `\drds` lists both settings.

## The fix

```sh
su postgres -c "psql -c 'alter database shop reset default_transaction_read_only'"
su postgres -c "psql -c 'alter role shop_app in database shop reset default_transaction_read_only'"
```

Resetting only the database's setting is not enough: the role's setting in that database takes precedence.

## What not to do

- `SET default_transaction_read_only = off` in one session: the app opens a new connection for every order.
- Making the app's role a superuser, or `trust` in `pg_hba.conf`.
- Recreating the database or deleting orders.
