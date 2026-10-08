# The cache that never forgets

## What was broken

The new cache server's configuration was copied from the session server: `maxmemory 4mb` with `maxmemory-policy noeviction`. For sessions, refusing writes is right: dropping a key would log a user out. For a cache it is wrong. The warmer stores every rendered product page and never deletes any, so the cache filled up within seconds, and since then Redis refuses every write with `OOM command not allowed when used memory > 'maxmemory'`. Pages are rendered again on every request, so they are slow.

## How to find it

- `/var/log/warmer/warmer.log` repeats the `OOM command not allowed` error.
- `redis-cli -p <port> info memory` shows `used_memory` at `maxmemory`, and `maxmemory_policy:noeviction`.
- `/etc/redis/cache.conf` says where its memory settings came from.

## The fix

```sh
sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/cache.conf
redis-cli -p <port> config set maxmemory-policy allkeys-lru
```

Raising `maxmemory` as well is fine if the server has the memory, but only the policy keeps the cache working once it fills again.

## What not to do

- `CONFIG SET` alone: the next restart reads the file and the problem returns. Persist it in the file (or with `CONFIG REWRITE`).
- `maxmemory 0` (no limit): the cache grows until the kernel kills something.
- `volatile-lru`: it only evicts keys with a TTL, and the warmer sets none, so writes are still refused.
- `FLUSHALL`: it works for a few seconds, until the cache is full again.
