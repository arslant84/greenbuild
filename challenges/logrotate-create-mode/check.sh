#!/bin/sh
# Exit 0 when the worker, running as its user, keeps logging across a rotation into a log only it and its
# group can read. The output is shown to the player: what is wrong, never how.
set -u

app=$(ls /usr/local/bin | grep -E '^(ingest|mailer|billing)$' | head -n 1)
log="/var/log/$app/$app.log"

if [ -z "$app" ] || [ ! -f "/etc/logrotate.d/$app" ]; then
  echo "the worker's logs are no longer rotated"
  exit 1
fi
"/usr/local/bin/$app-start"
if ! pgrep -u "$app" -f "/usr/local/bin/$app\$" > /dev/null; then
  echo "the worker is not running as its own user"
  exit 1
fi

# Tonight's rotation, then a few batches.
logrotate -f "/etc/logrotate.d/$app" > /dev/null 2>&1
sleep 3
if [ ! -s "$log.1" ]; then
  echo "the worker's logs are no longer rotated"
  exit 1
fi
if [ ! -s "$log" ]; then
  echo "after a rotation, the worker's log stays empty"
  exit 1
fi
if [ "$(stat -c %U "$log")" != "$app" ] || [ $(( $(stat -c %a "$log") % 10 )) -ne 0 ]; then
  echo "the worker's log has the wrong owner or can be read by anyone"
  exit 1
fi
echo "the worker keeps logging after a rotation"
