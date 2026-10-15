# Hints

## Hint 1

The app logs each order it fails to record under `/var/log/app/`. What exactly does the database answer, and do reads still work?

## Hint 2

A read-only transaction is a setting, not a broken disk. `SHOW default_transaction_read_only;` in a session as the app's role tells you what new connections get. Someone did maintenance last night; their log is under `/var/log/dba/`.

## Hint 3

Per-database and per-role defaults are stored in the cluster, and a role's setting in a database wins over the database's. `\drds` in `psql` (as the `postgres` user) lists them all. Reset every one that freezes writes, not just the first you find.
