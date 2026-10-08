#!/bin/sh
# Exit 0 when the cache, restarted from its configuration file, keeps a memory limit, evicts old
# entries to make room, and so accepts writes well past that limit. The output is shown to the
# player: what is wrong, never how.
set -u

conf=/etc/redis/cache.conf
# Enough 1 KB writes to fill a few times the 4 MB limit the cache started with.
readonly CHECK_WRITES=12000

port=$(awk '$1 == "port" { print $2 }' "$conf" 2> /dev/null)
if [ -z "$port" ]; then
  echo "the cache's configuration is missing"
  exit 1
fi
cli() { redis-cli -p "$port" "$@"; }

cli shutdown nosave > /dev/null 2>&1
sleep 1
if ! su -s /bin/sh redis -c "redis-server $conf" > /dev/null 2>&1 || ! sleep 1 || [ "$(cli ping 2> /dev/null)" != "PONG" ]; then
  echo "the cache does not start from its configuration"
  exit 1
fi

if [ "$(cli config get maxmemory | tail -1)" = "0" ]; then
  echo "the cache has no memory limit, so it can take all of the server's memory"
  exit 1
fi

value=$(printf '%01024d' 0)
# --pipe ends with a summary line: "errors: N, replies: M".
refused=$(seq "$CHECK_WRITES" | sed "s/.*/SET check:& $value/" | cli --pipe 2> /dev/null | sed -n 's/^errors: \([0-9]*\),.*/\1/p')
if [ "${refused:-$CHECK_WRITES}" -gt 0 ]; then
  echo "the cache refused $refused of $CHECK_WRITES writes"
  exit 1
fi

echo "the cache works as a cache"
