# Up, listening, unreachable

## What was broken

The app's new release listens on the IPv6 loopback by default (`LISTEN_ADDR=[::1]`, see its changelog), and its installer rewrote `/etc/<app>/app.env` with that default. nginx, configured by config management, still proxies to `127.0.0.1:<port>`. The app runs and answers on `[::1]:<port>`, which is what its developers test, but nothing listens on the IPv4 address, so nginx gets `Connection refused` and answers 502.

## How to find it

- `/var/log/nginx/error.log`: `connect() failed (111: Connection refused) while connecting to upstream, ... upstream: "http://127.0.0.1:<port>/"`.
- `netstat -ltnp`: the app's `httpd` listens on `::1:<port>`, not on `127.0.0.1:<port>`.
- `/opt/<app>/CHANGELOG.md` and `/etc/<app>/app.env`: the new default.

## The fix

```sh
sed -i 's/^LISTEN_ADDR=.*/LISTEN_ADDR=127.0.0.1/' /etc/<app>/app.env
pkill -u <app> httpd
su -s /bin/sh <app> -c /opt/<app>/start.sh
```

## What not to do

- Changing `proxy_pass` to `[::1]`: config management owns the nginx file and would put it back; the check refuses it.
- Starting a second listener by hand: the next start would bring the IPv6-only setting back; the check looks at the settings too.
- Listening on `0.0.0.0`: the app would answer from every interface, not just to nginx on this host.
