# Hints

## Hint 1

The warmer's log in `/var/log/warmer/` says what Redis answers to its writes. `redis-cli -p <port> info memory` compares the memory in use with the limit; the port is in `/etc/redis/cache.conf`.

## Hint 2

When Redis reaches `maxmemory`, `maxmemory-policy` decides what happens: refuse writes, or drop old keys to make room. Which one fits a cache, where every entry can be rebuilt?

## Hint 3

Set an `allkeys-` eviction policy (for example `allkeys-lru`) in the configuration file, and in the running server with `CONFIG SET` (or restart it). Removing the limit is not a fix: the cache would grow until the server runs out of memory.
