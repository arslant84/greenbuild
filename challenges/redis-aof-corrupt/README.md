# Sessions after the power cut

## What was broken

Redis keeps every write in its append-only file (`appendfsync always`). The power cut killed it in the middle of writing a command, and the file was later appended to again, so the torn command sits in the middle of `appendonly.aof.1.incr.aof`, not at its end. Redis tolerates a cut-off last command (`aof-load-truncated`), but not a malformed one followed by more data: it refuses to start with `Bad file format reading the append only file`.

## How to find it

- `/etc/redis/sessions.conf` names the log: `/var/log/redis/sessions.log` ends with `Bad file format reading the append only file appendonly.aof.1.incr.aof: make a backup of your AOF file, then use ./redis-check-aof --fix <filename.manifest>`.
- `/var/lib/sessions/appendonlydir/` holds the base RDB, the incremental AOF and the manifest.
- `redis-check-aof appendonly.aof.manifest` reports where the file stops being valid.

## The fix

```sh
cp -a /var/lib/sessions/appendonlydir /root/aof-backup
cd /var/lib/sessions/appendonlydir && redis-check-aof --fix appendonly.aof.manifest
su -s /bin/sh redis -c "redis-server /etc/redis/sessions.conf"
```

The fix cuts the file at the torn command, so whatever came after it (one session written after the crash) is lost; every session from before the power cut comes back.

## What not to do

- Deleting the AOF directory: Redis starts empty and every user stays logged out.
- Turning `appendonly` off: Redis starts from the empty base file and gives up durability; the check refuses both.
- Starting Redis as root: it would write files the redis user cannot read later.
