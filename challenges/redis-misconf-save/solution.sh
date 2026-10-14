#!/bin/sh
# Reference fix used by CI: give the cache's user its new snapshot directory and let it save again.
set -eu

volume=$(sed -n 's/^dir //p' /etc/redis.conf | tail -n 1)
chown redis:redis "$volume"
redis-cli bgsave > /dev/null
# Writes are accepted again once a snapshot succeeds; wait for it, up to 10 s.
for _ in $(seq 50); do
  redis-cli info persistence | grep -q '^rdb_last_bgsave_status:ok' && break
  sleep 0.2
done
