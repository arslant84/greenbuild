#!/bin/sh
# Exit 0 when the worker, as its own user, still takes jobs from the database the ops change chose, this
# morning's exports were produced, and a new request is produced too. The output is shown to the player:
# what is wrong, never how.
set -u

app=$(ls /etc | grep -E '^(reports|invoices|statements)$' | head -n 1)
done_dir="/var/lib/$app/done"
queue_db=$(sed -n 's/^# OPS-4410: the job queue lives in database \([0-9]*\) now.*/\1/p' "/etc/$app/worker.env" 2> /dev/null)
job="CHECK-$(date +%s)"

# The worker script's process name, which the kernel cuts at 15 characters.
worker=$(printf "%.15s" "$app-worker")
if [ -z "$app" ] || ! pgrep -u "$app" -x "$worker" > /dev/null || pgrep -u root -x "$worker" > /dev/null; then
  echo "the export worker is not running as its own user"
  exit 1
fi
if [ -z "$queue_db" ] || ! grep -qx "REDIS_DB=$queue_db" "/etc/$app/worker.env"; then
  echo "the job queue is not where the ops change put it"
  exit 1
fi
if [ "$(ls "$done_dir" 2> /dev/null | grep -c '^EXP-')" -lt 3 ]; then
  echo "this morning's exports were never produced"
  exit 1
fi
/usr/local/bin/request-export "$job" > /dev/null 2>&1
for _ in $(seq 20); do
  [ -f "$done_dir/$job.txt" ] && break
  sleep 0.5
done
if [ ! -f "$done_dir/$job.txt" ]; then
  echo "new export requests are not produced"
  exit 1
fi
echo "exports are produced again"
