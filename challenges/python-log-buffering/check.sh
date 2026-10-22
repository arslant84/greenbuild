#!/bin/sh
# Exit 0 when the worker, restarted with its own start script and running as its user, has its progress
# in the log within seconds. The output is shown to the player: what is wrong, never how.
set -u

readonly MIN_LINES=3

app=$(ls /opt | grep -E '^(mailer|thumbnailer|indexer)$' | head -n 1)
log="/var/log/$app/worker.log"

if [ -z "$app" ] || ! "/usr/local/bin/$app-worker" restart > /dev/null 2>&1; then
  echo "the worker does not start"
  exit 1
fi
sleep 1
pid=$(pgrep -u "$app" -f "/opt/$app/worker.py" | head -n 1)
if [ -z "$pid" ]; then
  echo "the worker is not running as its own user"
  exit 1
fi
sleep 3

lines=$(sed -n "/^worker $pid started\$/,\$p" "$log" 2> /dev/null | grep -c '^processed job ')
if [ "$lines" -lt "$MIN_LINES" ]; then
  echo "the worker's log still lags behind what it does"
  exit 1
fi
echo "the worker's log keeps up with its work"
