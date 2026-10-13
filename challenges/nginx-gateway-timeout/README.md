# The report that never arrives

## What was broken

The site's only `location /` proxies to the finance app with `proxy_read_timeout 5s`, a platform default meant to fail fast. `/report/monthly` takes 8–12 seconds to build, so nginx gives up after 5 and answers `504 Gateway Time-out`; every other page answers at once.

## How to find it

- `wget -S -O /dev/null http://127.0.0.1/report/monthly` answers 504 after about 5 seconds.
- `/var/log/nginx/error.log`: `upstream timed out (110: Operation timed out) while reading response header from upstream`.
- The app's port (from `nginx -T`) answers the report directly, after a few seconds.

## The fix

```nginx
location /report/ {
    proxy_pass http://127.0.0.1:8123;
    proxy_read_timeout 30s;
}
```

then `nginx -t && nginx -s reload`.

## What not to do

- Pointing finance at the app's port: the report must come through the site.
- Raising the timeout for the whole site works, but gives up the fast failure the platform wants for every other page; the report's own location is the precise fix.
