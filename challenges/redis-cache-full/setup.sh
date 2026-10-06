#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

cache_port=$((6300 + seed % 100))
key_prefix=$(echo "product price catalog" | cut -d' ' -f $((seed / 100 % 3 + 1)))

# Copied from the session server, where refusing writes beats losing a logged-in user.
cat > /etc/redis/cache.conf <<CONF
# Cache for the shop's product pages.
bind 127.0.0.1
port $cache_port
daemonize yes
pidfile /data/redis-cache.pid
logfile /var/log/redis/cache.log
dir /data
save ""
appendonly no

# Memory: copied from sessions.conf
maxmemory 4mb
maxmemory-policy noeviction
CONF

# The warmer caches every product page it renders, 1 KB each, and never deletes them.
cat > /usr/local/bin/cache-warmer <<SCRIPT
#!/bin/sh
value=\$(printf '%01024d' 0)
while true; do
  for n in \$(seq 200); do
    echo "SET $key_prefix:\$RANDOM\$RANDOM \$value"
  done | redis-cli -p $cache_port 2>&1 | grep -v -e '^OK\$' -e '^\$' | sed "s/^/\$(date -Iseconds) /" >> /var/log/warmer/warmer.log
  sleep 2
done
SCRIPT
chmod 0755 /usr/local/bin/cache-warmer

su -s /bin/sh redis -c "redis-server /etc/redis/cache.conf"
sleep 1
# What the warmer cached since the server went live: more than the limit, so the cache is full.
value=$(printf '%01024d' 0)
seq 6000 | sed "s/.*/SET $key_prefix:& $value/" | redis-cli -p "$cache_port" --pipe > /dev/null 2>&1 || true
su -s /bin/sh redis -c "nohup cache-warmer > /dev/null 2>&1 &"
# Let the warmer log its first refused writes before the player arrives.
sleep 3
rm -f "$0"
