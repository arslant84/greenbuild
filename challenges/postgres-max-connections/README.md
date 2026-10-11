# Too many clients already

## What was broken

PostgreSQL allows 20 connections, 3 of them reserved for superusers, so 17 are left for everyone else. The new reporting worker keeps a pool of 20 connections open, each waiting for report jobs (`POOL_SIZE=20`): 17 get in, the other 3 keep retrying, and every connection that is lost is reopened within a second. The app finds no free slot: `FATAL: sorry, too many clients already`.

## How to find it

- `/var/log/app/app.log`: `too many clients already`.
- As postgres: `select usename, state, count(*) from pg_stat_activity group by 1, 2;` shows 17 connections of the reporting role, each in a long `pg_sleep` wait; `show max_connections;` shows 20.
- `/usr/local/bin/<reporter>-worker` and `/etc/<reporter>/worker.env`: the pool size, and the loops that reconnect.

## The fix

Cap the role, then free what it holds; the worker reconnects up to the cap:

```sql
ALTER ROLE <reporter> CONNECTION LIMIT 5;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = '<reporter>';
```

Lowering `POOL_SIZE` and restarting the worker works too, and so does raising `max_connections` (a restart). The role limit keeps working whatever the worker's settings become.

## What not to do

- Only terminating the connections: the worker reopens them within a second; the check waits for that.
- Stopping the reporting worker: the reports are needed; the check expects it running and connected.
