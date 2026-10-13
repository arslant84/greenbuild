# Someone else's homepage

## What was broken

The app's nginx site has always had a typo in `server_name` (for example `shop.amce.test` instead of `shop.acme.test`). As the only site, it was nginx's default, so it answered every request whatever its `Host`. Yesterday the launch page was added with `listen 80 default_server`. Now a request for the app's real address matches no `server_name` and goes to the default: the launch page.

## How to find it

- `wget -qO- --header 'Host: shop.acme.test' http://127.0.0.1/` returns the launch page, while `--header 'Host: launch.acme.test'` returns it too.
- `nginx -T` lists both servers; the app's `server_name` differs from `PUBLIC_URL` in `/etc/<app>/app.env` by a letter.
- `/var/log/deploy.log` shows what changed yesterday.

## The fix

```sh
sed -i 's/server_name .*;/server_name shop.acme.test;/' /etc/nginx/conf.d/shop.conf
nginx -t && nginx -s reload
```

## What not to do

- Deleting the launch site or removing `default_server` from it: marketing's links on other addresses must still land there.
- Making the app the `default_server`: the app's own address still would not match its `server_name`, and unknown addresses would show the app.
