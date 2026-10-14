# Hints

## Hint 1

The app logs every failure under `/var/log/`. What exactly does the cache answer when a page tries to count a visit?

## Hint 2

Redis stops accepting writes when its last snapshot failed, as long as `stop-writes-on-bgsave-error` is on. Its own log under `/var/log/redis/` says why the snapshot failed, and `redis-cli info persistence` shows how the last one went.

## Hint 3

Look at who owns the directory the snapshots now go to (`dir` in `/etc/redis.conf`) and which user Redis runs as. Fix that, then ask for a snapshot (`redis-cli bgsave`). Turning the safety switch or snapshots off hides the problem until the data is lost.
