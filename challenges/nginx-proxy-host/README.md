# Sign in somewhere else

## What was broken

The shop writes absolute links from the `Host` header it receives: the account page links to `http://<Host>/login?next=/account` (the same link goes into emails). The new nginx site has only `proxy_pass http://127.0.0.1:<port>;`, and without `proxy_set_header Host` nginx sends the upstream's own address as `Host`. So customers on `shop.acme.test` get a link to `http://127.0.0.1:<port>/login`, which their browsers cannot reach. nginx's default `proxy_redirect` would have fixed such an address in a redirect's `Location`, but it never rewrites links inside pages.

## How to find it

- `wget -qO- --header 'Host: shop.acme.test' http://127.0.0.1/account` shows the link with `127.0.0.1:<port>`.
- `nginx -T` shows the site's location with `proxy_pass` and no `proxy_set_header`.

## The fix

```nginx
location / {
    proxy_pass http://127.0.0.1:8123;
    proxy_set_header Host $host;
}
```

then `nginx -t && nginx -s reload`.

## What not to do

- `proxy_set_header Host shop.acme.test;`: visitors of `www.shop.acme.test` would be sent to the other name.
- Changing the shop to always link to one fixed address: the shop is not what changed.
