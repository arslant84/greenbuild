#!/bin/sh
# Exit 0 when a forced rotation still rotates nginx's access log, and nginx writes the next visit into
# the new access.log. The output is shown to the player: what is wrong, never how.
set -u

log=/var/log/nginx/access.log
before="/greenbuild-check-before-$$"
after="/greenbuild-check-after-$$"

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi

wget -q -O /dev/null "http://127.0.0.1$before" 2> /dev/null
if ! logrotate -f /etc/logrotate.conf > /dev/null 2>&1; then
  echo "the log rotation fails"
  exit 1
fi
# nginx reopens its logs in its own time after a signal.
sleep 1
wget -q -O /dev/null "http://127.0.0.1$after" 2> /dev/null
sleep 1

# A rotation that keeps the old lines in log.1 (plain or compressed) still rotates.
if ! { cat "$log.1" 2> /dev/null; zcat "$log.1.gz" 2> /dev/null; } | grep -q "$before"; then
  echo "the access log is no longer rotated"
  exit 1
fi
if ! grep -q "$after" "$log" 2> /dev/null; then
  echo "after a rotation, visits do not reach access.log"
  exit 1
fi

echo "visits are logged again"
