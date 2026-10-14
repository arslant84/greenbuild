# Only the home page works

## What was broken

The single-page app moved from an Apache host to nginx (OPS-1877). On Apache, `.htaccess` had `FallbackResource /index.html`, so every address the app's router knows (`/orders/1042`, `/settings/profile`) got `index.html`, and the router in the browser drew the page. nginx ignores `.htaccess`; its new site has no fallback, so it looks for a file named `orders/1042` and answers 404. Links clicked inside the app still work (the router changes the address without asking the server), but opening or refreshing any page other than `/` fails.

## How to find it

- `wget --header 'Host: <app>.acme.test' http://127.0.0.1/orders/1042` answers 404; `/` works.
- `/var/log/nginx/<app>.access.log` shows 404s for app addresses; `error.log` shows `open() "/srv/<app>/orders/1042" failed`.
- `/srv/<app>/.htaccess` has the rule Apache used.

## The fix

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Add it to `/etc/nginx/conf.d/<app>.conf` next to `location /api/`, then `nginx -t && nginx -s reload`.

## What not to do

- Copying every route as a file or a `location` per route: the next route breaks again.
- Answering every 404 with the page, API errors included: the app can no longer tell a missing order from a real one.
- Pointing the fallback at the API, or rewriting script and style addresses to `index.html`.
