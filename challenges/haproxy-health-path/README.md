# 503 after the release

## What was broken

Release 2.0 of the app moved its health endpoint from `/health` to `/healthz` (APP-430), but haproxy still checks `option httpchk GET /health`. Both copies answer that check with 404, haproxy marks them `DOWN` (`L7STS/404`), and a backend with no live server answers every request with 503.

## How to find it

- `curl -i http://127.0.0.1/`: the 503 comes from haproxy, not from the app.
- `curl -s 'http://127.0.0.1:8404/stats;csv'` (or the HTML page at `/stats`): both servers are `DOWN`, with `L7STS` and code 404.
- `/etc/haproxy/haproxy.cfg`: the check path; `curl -i` that path on one copy's port answers 404, `/healthz` answers 200.
- `/var/log/<app>/release.log`: the release note about the new path.

## The fix

```sh
sed -i 's#GET /health$#GET /healthz#' /etc/haproxy/haproxy.cfg
haproxy-reload
```

## What not to do

- Removing `check` from the servers: haproxy then sends visitors to a copy that has gone down.
- `http-check expect status 404`: a check that passes on "not found" says nothing about health.
- Adding a `/health` file to the app's release: the release is not the operator's to change.
