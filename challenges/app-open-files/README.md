# Too many customers

## What was broken

The media server is an nginx that writes one access log per customer. `appctl` starts it with the open-file limit from its environment file, `LIMIT_NOFILE=32`, which was plenty for the first customers. Yesterday's onboarding took the server past 40 customers, so at start nginx runs out of file descriptors while opening the logs (`open() ".../customer-30.log" failed (24: ...)` in the app's log) and exits. nginx, which proxies the site to the app, answers 502.

## How to find it

- The site answers 502, so nginx is up and the app behind it is not.
- `appctl start` reports a failure and points to the app's log in `/var/log/<app>/`.
- The log ends with an `[emerg]` line: error 24 (`EMFILE`, too many open files) on one of the customer logs.
- `appctl` runs the app under `ulimit -n "$LIMIT_NOFILE"`, read from `/etc/<app>/<app>.env`.

## The fix

```sh
sed -i 's/^LIMIT_NOFILE=.*/LIMIT_NOFILE=4096/' /etc/<app>/<app>.env
appctl start
```

## What not to do

- Deleting customers' `access_log` lines: the site comes back, but those customers lose their logs. The check refuses it.
- Starting nginx by hand without the limit: the next restart through `appctl` fails again.
- Setting the limit just above today's count: the next onboarding breaks it again. Leave headroom, as with `LimitNOFILE=` in a systemd unit.
