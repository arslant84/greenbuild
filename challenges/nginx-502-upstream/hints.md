# Hints

## Hint 1

A 502 comes from nginx, not from the app behind it. nginx usually says why in its own error log.

## Hint 2

Compare where nginx sends requests with where the app is actually listening. The app keeps its settings in `/srv/app` and its log in `/var/log/app`, and `netstat -ltnp` shows every listening port.

## Hint 3

The port in `proxy_pass` in `/etc/nginx/conf.d/site.conf` must match the app's port. After editing, check the config with `nginx -t` and apply it with `nginx -s reload`.
