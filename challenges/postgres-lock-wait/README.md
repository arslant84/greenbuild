# One customer can't pay

## What was broken

Last night someone ran the reconciliation by hand in `psql`: `begin; update accounts … where id = <account>;` and never committed. The session is still open, `idle in transaction`, and holds the row lock on that account. Every payment to it waits for the lock and gives up after the service's `lock_timeout` of 3 seconds; every other account is unaffected.

## How to find it

- `/var/log/app/payments.log`: `canceling statement due to lock timeout` for one account only.
- `select pid, application_name, state, xact_start, query from pg_stat_activity;` shows `nightly-reconcile` idle in transaction since last night.
- While a payment waits, `select pid, pg_blocking_pids(pid) from pg_stat_activity where application_name = 'payments';` names the blocker.

## The fix

```sql
select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'nightly-reconcile';
```

Ending its `psql` client works too. Setting `idle_in_transaction_session_timeout` keeps it from happening again.

## What not to do

- Restarting PostgreSQL: it ends every session of every client to free one row.
- Deleting or recreating the account.
