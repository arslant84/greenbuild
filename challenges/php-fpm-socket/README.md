# Hardened into a 502

## What was broken

The app's PHP-FPM pool listened on a unix socket with mode 0666, so any local user could talk to the app. Yesterday's hardening (SEC-2291) changed it to `listen.mode = 0660` and gave the socket to the app's own user and group. That closed the hole, but it also locked out nginx, whose workers run as `nginx`, which is in neither. Every request now fails with `connect() to unix:/run/php-fpm/<app>.sock failed (13: Permission denied)`, and nginx answers 502.

## How to find it

- The site answers 502, so nginx is up and something behind it is not reachable.
- `/var/log/nginx/error.log` has the `connect() ... (13: Permission denied)` line with the socket's path.
- `ls -l /run/php-fpm/` shows the socket as `srw-rw---- <app> <app>`.
- `ps -o user,args` shows nginx's workers as `nginx`.
- The pool file in `/etc/php84/php-fpm.d/` has the hardening, with a comment pointing at the ticket.

## The fix

```sh
sed -i 's/^listen.group = .*/listen.group = nginx/' /etc/php84/php-fpm.d/<app>.conf
kill -USR2 "$(cat /run/php-fpm/php-fpm.pid)"    # PHP-FPM reloads and recreates the socket
```

Adding nginx's user to the app's group (`addgroup nginx <app>`, then `nginx -s reload`) works too.

## What not to do

- Putting `listen.mode = 0666` back: it undoes the hardening, and the check refuses it.
- `chmod 666` on the socket: PHP-FPM recreates it with the configured mode at the next restart.
- Running nginx's workers or the pool as root: the check refuses it, and it is a far bigger hole.
