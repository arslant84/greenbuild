# Read-only overnight

## What was broken

The cache's data moved to a new volume (OPS-2231): `dir <volume>` was added to `/etc/redis.conf`, but the directory was created by root with mode 0755. Redis runs as `redis`, so its first snapshot after the move failed with `Permission denied`. With `stop-writes-on-bgsave-error yes` (the default), Redis then refuses every write with `MISCONF`, and every page of the app, which counts visits with `INCR`, answers 500.

## How to find it

- `/var/log/<app>/app.log`: `cache error: MISCONF Redis is configured to save RDB snapshots, but it's currently unable to persist to disk…`
- `/var/log/redis/redis.log`: `Failed opening the temp RDB file … (in server root dir <volume>) for saving: Permission denied`.
- `redis-cli info persistence`: `rdb_last_bgsave_status:err`; `ls -ld <volume>` shows root as the owner.

## The fix

```sh
chown redis:redis /srv/cache-data   # the dir from /etc/redis.conf
redis-cli bgsave                     # writes are accepted again once a snapshot succeeds
```

## What not to do

- `config set stop-writes-on-bgsave-error no`: writes work, but nothing is saved, and a restart loses them.
- Turning snapshots off (`save ""`) or pointing `dir` back at the old place: the move is undone and the new volume stays unused.
- Making the directory writable by every user, or running Redis as root.
