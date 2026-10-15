# Hints

## Hint 1

The app logs each order it fails to record under `/var/log/app/`. The table has the column the error says is missing, so which `orders` table is the app talking to? Someone changed the database last night; their log is under `/var/log/dba/`.

## Hint 2

An unqualified table name is looked up in the schemas of `search_path`, in order. `SHOW search_path;` in a session as the app's role, and `\dt *.orders`, tell you which tables named `orders` exist and which one the app finds first.

## Hint 3

Per-role and per-database defaults are stored in the cluster, and a role's setting in a database wins over the others. `\drds` in `psql` (as the `postgres` user) lists them all. Only the analytics role asked for the new search path.
