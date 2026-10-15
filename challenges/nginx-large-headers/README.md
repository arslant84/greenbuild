# Too much to sign in

## What was broken

Sign-in moved to a new identity provider (SSO-2210), whose session carries the user's group claims: the app's `Set-Cookie` header is now 5 to 6.5 KB. nginx reads an upstream's response headers into one buffer, `proxy_buffer_size`, which defaults to one memory page (4 KB). The headers do not fit, so nginx answers 502 while the app has logged a successful sign-in.

## How to find it

- `curl -i http://127.0.0.1/cgi-bin/login` answers 502; `curl -i http://127.0.0.1:<port>/cgi-bin/login` (the app itself, port in the site's `proxy_pass`) answers 200 with a huge `Set-Cookie`.
- `/var/log/nginx/error.log`: `upstream sent too big header while reading response header from upstream`.
- `/var/log/<app>/ops.log`: the move to the new provider.

## The fix

```nginx
# /etc/nginx/conf.d/<app>.conf, inside location / { ... }
proxy_buffer_size 16k;
proxy_buffers 8 16k;
```

```sh
nginx -t && nginx -s reload
```

Raising only `proxy_buffer_size` fails `nginx -t`: `proxy_busy_buffers_size` defaults to twice the larger buffer size and must stay below all of `proxy_buffers` minus one; raise `proxy_buffers` too, or set `proxy_busy_buffers_size`.

## What not to do

- `proxy_buffering off`: the response headers still have to fit in `proxy_buffer_size`.
- Shrinking or dropping the session cookie in the app: the identity provider issues it; the check wants it whole.
- `large_client_header_buffers`: it sizes the headers browsers send, not what the app answers.
