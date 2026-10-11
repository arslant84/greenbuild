#!/bin/sh
# Reference fix used by CI: truncate the AOF at the torn write, as Redis's log suggests, then start the
# session store as the redis user.
set -eu

cd /var/lib/sessions/appendonlydir
echo y | redis-check-aof --fix appendonly.aof.manifest > /dev/null
su -s /bin/sh redis -c "redis-server /etc/redis/sessions.conf"
sleep 1
