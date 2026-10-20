# Stuck on reconnecting

## What was broken

The app moved behind nginx (PLAT-512), and the live feed's `location /live` was written as a plain HTTP proxy. nginx talks to upstreams over HTTP/1.0 by default and does not pass the hop-by-hop `Upgrade` and `Connection` headers, so the feed receives `GET /live HTTP/1.0` with no upgrade request. The websocket service refuses the handshake, nginx answers 502, and the page's websocket keeps reconnecting.

Both halves are needed: HTTP/1.1 alone carries no upgrade request, and the upgrade headers over HTTP/1.0 are still refused.

## How to find it

- `/var/log/<app>/live.log`: `unsupported protocol; expected HTTP/1.1: GET /live HTTP/1.0`.
- `/var/log/nginx/access.log`: the 502 on `/live`.
- Repeat the handshake with curl: `curl -i -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' http://127.0.0.1/live`.
- `/etc/nginx/http.d/<app>.conf`: the `/live` location.

## The fix

In `location /live`, after `proxy_pass`:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Then `nginx -t && nginx -s reload`.

## What not to do

- Only one of the two halves: the handshake still fails.
- `return 101` or any answer nginx makes up: the check sends a message and waits for the feed's reply.
- Running the feed as root, or exposing it directly instead of through the site: the check connects through nginx and wants the feed running as its user.
