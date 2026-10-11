#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

port=$((6300 + seed % 100))
sessions=$((20 + seed / 100 % 50))

cat > /etc/redis/sessions.conf <<CONF
# Session store for the web app. Every write is on disk before Redis answers it.
bind 127.0.0.1
port $port
daemonize yes
pidfile /var/lib/sessions/redis.pid
logfile /var/log/redis/sessions.log
dir /var/lib/sessions
save ""
appendonly yes
appendfsync always
CONF
chmod 0644 /etc/redis/sessions.conf

su -s /bin/sh redis -c "redis-server /etc/redis/sessions.conf"
sleep 1
seq "$sessions" | sed "s/.*/SET session:& user-&/" | redis-cli -p "$port" > /dev/null

# The power cut: the server dies without a word, in the middle of writing a command to the AOF.
kill -9 "$(cat /var/lib/sessions/redis.pid)"
sleep 1
rm -f /var/lib/sessions/redis.pid
incr=$(ls /var/lib/sessions/appendonlydir/*.incr.aof)
printf '*2\r\n$3\r\nDEL\r\n$x15\r\nsession:\r\n*3\r\n$3\r\nSET\r\n$11\r\nsession:999\r\n$8\r\nuser-999\r\n' >> "$incr"

# The supervisor tried to bring it back after the power came back.
su -s /bin/sh redis -c "redis-server /etc/redis/sessions.conf" || true
sleep 1
rm -f "$0"
