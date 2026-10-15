# The wrong orders

## What was broken

Last night's change (OPS-5120) created a `reporting` schema for the analytics team, with its own daily summary table also named `orders`, readable by every role. It set `search_path = reporting, public` for the analytics role in the database, and the same statement, copied for the next role, also ran for the app's role (`ALTER ROLE <app> IN DATABASE <db> SET search_path …`). The app's unqualified `orders` now resolves to `reporting.orders`, which has no `ref` column, so every checkout fails with `column "ref" of relation "orders" does not exist`.

## How to find it

- `/var/log/app/app.log`: `ERROR: column "ref" of relation "orders" does not exist`.
- `/var/log/dba/maintenance.log`: the OPS-5120 change.
- As the app: `SHOW search_path;` answers `reporting, public`, and `\d orders` shows the summary table. As postgres: `\drds` lists the setting on both roles.

## The fix

```sh
su postgres -c "psql -c 'alter role shop_app in database shop reset search_path'"
```

`ALTER ROLE shop_app SET search_path …` or `ALTER DATABASE shop SET search_path …` is not enough: the role's setting in that database takes precedence.

## What not to do

- Dropping or renaming `reporting.orders`, or revoking the analytics team's access: their dashboards need it.
- Resetting the analytics role's search path: that was the change they asked for.
- Granting the app rights on `reporting.orders`: the orders would land in another team's table, if they fit at all.
