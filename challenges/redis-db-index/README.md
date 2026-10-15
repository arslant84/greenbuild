# Queued into the void

## What was broken

Ops moved the job queue to its own Redis database last night (OPS-4410) and updated the worker's settings, but not the web app's. The app still pushes export jobs to database 0, while the worker waits on the new database, so every export since then sits in a list nobody reads.

## How to find it

- `/var/log/<app>/app.log` shows exports queued; `worker.log` shows the worker listening on database N and nothing done.
- `/var/log/<app>/ops.log` and the comment in `/etc/<app>/worker.env` describe the move.
- `redis-cli -n 0 LLEN exports` answers 3; `redis-cli -n N LLEN exports` answers 0.

## The fix

```sh
sed -i 's/^REDIS_DB=.*/REDIS_DB=3/' /etc/reports/app.env   # the database from worker.env
redis-cli -n 0 MOVE exports 3                               # this morning's jobs
```

The web app reads its settings on every request, so it needs no restart.

## What not to do

- Moving the worker back to database 0: it undoes the ops change, and the queue shares a database with whatever else lives there.
- Fixing only new requests: this morning's three customers never get their exports.
- Running the worker as root.
