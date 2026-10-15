#!/bin/sh
# Reference fix used by CI: point the web app at the queue's new database, and move the jobs it queued in
# the old one there, so the worker produces them.
set -eu

app=$(ls /etc | grep -E '^(reports|invoices|statements)$' | head -n 1)
queue_db=$(sed -n 's/^REDIS_DB=//p' "/etc/$app/worker.env")
sed -i "s/^REDIS_DB=.*/REDIS_DB=$queue_db/" "/etc/$app/app.env"
redis-cli -n 0 MOVE exports "$queue_db" > /dev/null
# The worker takes each job within a second or two; wait until the backlog is done.
for _ in $(seq 20); do
  [ "$(ls "/var/lib/$app/done" | grep -c '^EXP-')" -ge 3 ] && break
  sleep 0.5
done
