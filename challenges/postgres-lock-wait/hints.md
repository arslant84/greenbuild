# Hints

## Hint 1

The payment service logs every failure under `/var/log/app/`. What exactly does the database answer, and for which account?

## Hint 2

A lock timeout means another session holds a lock the update needs. `pg_stat_activity` lists every session with its state and application name; a session that started a transaction and never finished it keeps its locks for as long as it lives.

## Hint 3

Find the session that blocks the account's row (`pg_blocking_pids()` helps) and end that session, not the database. Then try a payment.
