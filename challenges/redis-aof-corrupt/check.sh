#!/bin/sh
# Exit 0 when the session store runs as the redis user on its port with the append-only file on and
# valid, and still holds the sessions from before the power cut. The output is shown to the player:
# what is wrong, never how.
set -u

conf=/etc/redis/sessions.conf
port=$(sed -n 's/^port \([0-9]*\)$/\1/p' "$conf" 2> /dev/null)
cli() {
  redis-cli -p "$port" "$@" 2> /dev/null
}

if [ "$(cli ping)" != "PONG" ]; then
  echo "the session store does not answer on its port"
  exit 1
fi
if ! pgrep -u redis -f "redis-server .*:$port" > /dev/null; then
  echo "the session store is not running as the redis user"
  exit 1
fi
if [ "$(cli config get appendonly | tail -n 1)" != "yes" ]; then
  echo "the session store no longer writes its append-only file"
  exit 1
fi
if [ "$(cli exists session:1)" != "1" ]; then
  echo "the sessions from before the power cut are gone"
  exit 1
fi
if ! (cd /var/lib/sessions/appendonlydir && redis-check-aof appendonly.aof.manifest > /dev/null 2>&1); then
  echo "the append-only file is still not valid"
  exit 1
fi
echo "sessions are back"
