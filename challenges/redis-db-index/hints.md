# Hints

## Hint 1

The web app logs each export it queues, and the worker logs each one it finishes, under `/var/log/`. Do the two logs agree? What did ops change last night?

## Hint 2

One Redis server holds 16 numbered databases, and a key in one is invisible from the others. `redis-cli -n <db> LLEN exports` shows how many jobs wait in each. Compare where the web app puts jobs with where the worker takes them.

## Hint 3

Follow the ops change: point the web app at the queue's new database, rather than moving the worker back. Then the jobs already queued in the old database still wait there; `MOVE` takes a key to another database.
