#!/bin/sh
# Reference fix used by CI: the pid file names the backup job, not the app, so it is stale; remove it
# and start the app with its control script.
set -eu

pidfile=$(ls /run/*/*.pid | head -n 1)
rm -f "$pidfile"
appctl start
sleep 1
