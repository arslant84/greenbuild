# The app will not start after the upgrade

## What was broken

Version 2.0 of the app renamed its `PORT` setting to `LISTEN_PORT`. The upgrade replaced the program but not the environment file, which still said `PORT=...`. On restart the app found no `LISTEN_PORT` and refused to start, so nginx had nothing to proxy to and answered `502 Bad Gateway`.

## How to find it

- `appctl status` says the app is stopped.
- Its log (`/var/log/<app>/<app>.log`) ends with `fatal: LISTEN_PORT is not set; refusing to start`.
- `/etc/<app>/<app>.env` sets `PORT=...`, and `/srv/<app>/CHANGELOG.md` says 2.0 renamed it.

## The fix

```sh
sed -i 's/^PORT=/LISTEN_PORT=/' /etc/<app>/<app>.env
appctl start
```

The port stays the same, so nginx's `proxy_pass` already points at it.

## What not to do

- `LISTEN_PORT=... httpd ...` by hand brings the site back until the next restart or reboot, and then the outage repeats.
- Changing nginx to another port, or running the app as root, treats the symptom. The configuration was the problem.
- Upgrades that rename settings deserve a check before the restart: read the changelog, or let the app accept the old name with a warning for one release.
