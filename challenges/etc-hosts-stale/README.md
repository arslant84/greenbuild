# The migration that moved nothing

## What was broken

nginx proxies the site to `<service>.internal`, a name that `/etc/hosts` resolves. Yesterday's migration moved the service onto this host, but the hosts entry still points at the old node's address. nginx connects to an address that no longer answers (`connect() to 10.20.0.15:<port> failed (101: Network unreachable)`) and the site answers 502, while the backend runs fine on `127.0.0.1`.

## How to find it

- The site answers 502; `/var/log/nginx/error.log` shows the upstream address nginx tried.
- `ss -ltnp` shows the backend listening on `127.0.0.1:<port>`.
- `getent hosts <service>.internal` returns the old address; `/etc/hosts` has the entry, commented with the migration ticket.

## The fix

```sh
vi /etc/hosts            # change the entry to: 127.0.0.1 <service>.internal
nginx -s reload          # nginx resolves upstream names when it loads its configuration
```

## What not to do

- Changing `proxy_pass` to an IP: config management owns the nginx file and would put the name back; the check refuses it.
- `sed -i` on `/etc/hosts` inside a container: the file is a mount, so the rename `sed -i` does fails with "Resource busy". Edit it in place.
- Forgetting the reload: nginx keeps the address it resolved at start until it loads its configuration again.
