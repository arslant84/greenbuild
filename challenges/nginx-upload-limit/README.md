# Too big to ship

## What was broken

The artifact store is nginx with WebDAV `PUT`. A hardening baseline (SEC-1450), included in every server block, set `client_max_body_size 512k`. Build artifacts are up to 20 MB, so nginx refuses every real upload with `413 Request Entity Too Large` (`client intended to send too large body` in its error log).

## How to find it

- `curl -T big.bin http://127.0.0.1/<store>/big.bin` answers 413; small files still upload.
- `/var/log/nginx/error.log`: `client intended to send too large body: <n> bytes`.
- `nginx -T | grep client_max_body_size` finds the value in `/etc/nginx/snippets/hardening.conf`.

## The fix

```nginx
# /etc/nginx/conf.d/store.conf, inside location /<store>/ { ... }
client_max_body_size 25m;
```

```sh
nginx -t && nginx -s reload
```

## What not to do

- `client_max_body_size 0`: no limit at all; anyone can fill the disk with one request. The check refuses it.
- Raising it in `nginx.conf`'s `http {}` block: the server block's value from the snippet is more specific and still wins.
- Raising the baseline snippet itself: it works, but every site on the host now accepts 25 MB bodies, which SEC-1450 was meant to prevent.
