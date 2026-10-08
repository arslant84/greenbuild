# Hints

## Hint 1

nginx's error log in `/var/log/nginx/` names the address it tries to reach for the backend. Is that address this host? `ss -ltnp` shows where the backend really listens.

## Hint 2

nginx reaches the backend by a name. `getent hosts <name>` shows what the name resolves to, and `/etc/hosts` is where this host keeps names it resolves by itself.

## Hint 3

Point the name at this host (`127.0.0.1`) in `/etc/hosts`, then reload nginx: it resolves upstream names only when it loads its configuration. In a container `/etc/hosts` is mounted, so edit it in place (`vi`, or `cat` into it) rather than with `sed -i`.
