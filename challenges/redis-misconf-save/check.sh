#!/bin/sh
# Exit 0 when the app's pages count visits again and the cache, as its own user, saves snapshots on the new
# volume with its safety switch still on. The output is shown to the player: what is wrong, never how.
set -u

app=$(ls /opt 2> /dev/null | grep -v greenbuild | head -n 1)
port=$(sed -n 's/^# Starts .* on port \([0-9]*\)\..*/\1/p' "/usr/local/bin/$app-start" 2> /dev/null)
volume=$(sed -n 's/^dir //p' /etc/redis.conf | tail -n 1)
setting() {
  redis-cli config get "$1" 2> /dev/null | sed -n 2p
}
visits() {
  wget -q -T 5 -O - "http://127.0.0.1:$port/check" 2> /dev/null | sed -n 's/^.*: \([0-9]*\) visits$/\1/p'
}
# Asks for a snapshot and waits up to 10 s for it to finish; fails when it does not succeed. LASTSAVE
# counts whole seconds, so a second passes first to tell this snapshot from an earlier one.
snapshot() {
  before=$(redis-cli lastsave 2> /dev/null)
  sleep 1
  redis-cli bgsave > /dev/null 2>&1
  for _ in $(seq 50); do
    if [ "$(redis-cli lastsave 2> /dev/null)" != "$before" ]; then
      return 0
    fi
    sleep 0.2
  done
  return 1
}

if ! pgrep -u redis redis-server > /dev/null || pgrep -u root redis-server > /dev/null; then
  echo "the cache is not running as its own user"
  exit 1
fi
if [ -z "$port" ] || ! pgrep -u "$app" -f "/opt/$app/app.py" > /dev/null; then
  echo "the app is not running as its own user"
  exit 1
fi
first=$(visits)
second=$(visits)
if [ -z "$first" ] || [ "$second" != "$((first + 1))" ]; then
  echo "the app's pages still cannot count visits"
  exit 1
fi
if [ "$(setting stop-writes-on-bgsave-error)" != "yes" ]; then
  echo "the cache would accept writes it cannot save"
  exit 1
fi
if [ -z "$(setting save)" ]; then
  echo "the cache no longer saves snapshots"
  exit 1
fi
case "$volume" in
  /srv/cache-data | /data/redis | /var/lib/cache-volume) ;;
  *) echo "the cache's snapshots are not on the new volume"; exit 1 ;;
esac
if [ "$(setting dir)" != "$volume" ]; then
  echo "the cache's snapshots are not on the new volume"
  exit 1
fi
if ! snapshot || [ ! -s "$volume/dump.rdb" ]; then
  echo "the cache cannot save a snapshot"
  exit 1
fi
# The last digit of the mode is what every other user may do.
case "$(stat -c %a "$volume")" in
  *[2367]) echo "the snapshot directory can be written by every user"; exit 1 ;;
esac
echo "the pages count visits again and the cache saves its snapshots"
