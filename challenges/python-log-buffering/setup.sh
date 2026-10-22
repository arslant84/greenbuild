#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "mailer thumbnailer indexer" | cut -d' ' -f $((seed % 3 + 1)))
first_job=$((1000 + seed % 9000))
log="/var/log/$app/worker.log"

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/opt/$app" "/var/log/$app"

cat > "/opt/$app/worker.py" <<PY
# The $app worker: takes jobs off the queue and reports each one it finishes.
import os
import time

JOB_SECONDS = 0.3


def main():
    print(f"worker {os.getpid()} started")
    job = $first_job
    while True:
        time.sleep(JOB_SECONDS)
        print(f"processed job {job}")
        job += 1


main()
PY

cat > "/usr/local/bin/$app-worker" <<SCRIPT
#!/bin/sh
# Starts or restarts the $app worker in the background, as the $app user, logging to $log.
case "\${1:-start}" in
  restart) pkill -u $app -f "/opt/$app/worker.py" ; sleep 1 ;;
  start) ;;
  *) echo "usage: $app-worker [start|restart]" >&2; exit 2 ;;
esac
pgrep -u $app -f "/opt/$app/worker.py" > /dev/null && exit 0
su -s /bin/sh $app -c "nohup python3 /opt/$app/worker.py >> $log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-worker"

# Until OPS-640 the worker ran in a terminal session, and its output was captured from there.
yesterday=$(date -u -d @$(( $(date +%s) - 86400 )) +%F)
{
  echo "worker 812 started"
  for job in $(seq $((first_job - 40)) $((first_job - 1))); do echo "processed job $job"; done
} > "$log"
chown -R "$app:$app" "/var/log/$app"
echo "${yesterday}T22:10:00Z OPS-640: $app worker moved from a tmux session to /usr/local/bin/$app-worker, logging to $log" >> /var/log/ops.log
"$app-worker" start
rm -f "$0"
