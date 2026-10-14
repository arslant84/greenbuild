# Locked out of its own cache

## What was broken

Security added `requirepass` to `/etc/redis.conf` and restarted Redis (SEC-1190), but nobody told the app: its settings (`/etc/<app>/app.env`) have no `REDIS_PASSWORD`, so every `INCR` the pages make is refused with `NOAUTH Authentication required` and the pages answer 500.

## How to find it

- `/var/log/<app>/app.log`: `cache error: NOAUTH Authentication required.`
- `redis-cli ping` answers `NOAUTH`; `grep requirepass /etc/redis.conf` shows the password.
- The app's settings name the host and port but no password; the app reads them only at start.

## The fix

```sh
echo "REDIS_PASSWORD=$(sed -n 's/^requirepass //p' /etc/redis.conf)" >> /etc/catalog/app.env
chmod 600 /etc/catalog/app.env
pkill -f /opt/catalog/app.py && catalog-start
```

## What not to do

- Removing `requirepass`: the cache is open to anyone who reaches it again.
- Leaving the settings file readable by every user once it holds the password.
- Starting the app as root.
