# Write-up: The site returns 502

Shown to players after they solve the challenge or give up. Not indexed by search engines.

## What was broken

nginx forwarded every request to `127.0.0.1` on a port where nothing was listening. The app was healthy, just on a different port. nginx could not connect, so it answered `502 Bad Gateway`.

## How to find it

1. **Confirm the symptom.** `wget -S -O /dev/null http://127.0.0.1/` shows `502 Bad Gateway`. A 502 means nginx is up but the upstream behind it failed.
2. **Read nginx's error log.** `tail /var/log/nginx/error.log` shows:
   `connect() failed (111: Connection refused) while connecting to upstream ... upstream: "http://127.0.0.1:<port>/"`.
   Error 111 means nothing accepts connections on that address.
3. **Find where the app really listens.** Any of these works:
   - `netstat -ltnp` lists the listening ports
   - `ps -o user,args` shows the app's command line with its port
   - `/var/log/app/app.log` and `/srv/app/app.env` record the port
4. **Compare** the two ports. They differ.

## The fix

Point nginx at the app's real port, then validate and reload without dropping connections:

```sh
vi /etc/nginx/conf.d/site.conf   # proxy_pass http://127.0.0.1:<app port>;
nginx -t
nginx -s reload
```

Changing the app to listen on nginx's port also works, but the usual rule is to change the proxy, which you own, rather than the app's agreed port.

## In real life

This happens after an app's port changes in one place and not the other: a new release, a container port mapping, a config template. What helps:

- **Read the proxy's error log first.** It names the exact upstream address it tried.
- **One source of truth for ports**, such as a shared variable or service discovery, instead of two hand-edited files.
- **Health checks on the upstream** so the alert says "app unreachable" rather than "users see 502".
- **`nginx -t` before every reload**, so a typo never takes the site down.
