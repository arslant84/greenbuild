# Unstyled after the deploy

## What was broken

A deploy change (DEP-881) serves built assets straight from the current release with `location /assets/ { alias /srv/<site>/current/build/assets; }`. The alias lacks the trailing slash its location has. nginx swaps the location's prefix for the alias, so `/assets/app-1234.css` becomes `/srv/<site>/current/build/assetsapp-1234.css`, and every asset answers 404.

## How to find it

- `curl -I http://127.0.0.1/assets/app-<hash>.css` answers 404; the file exists under `current/build/assets/`.
- `/var/log/nginx/error.log`: `open() ".../build/assetsapp-<hash>.css" failed (2: No such file or directory)`. The missing slash shows in the path.
- `/var/log/nginx/deploy.log` names the change.

## The fix

```nginx
location /assets/ {
    alias /srv/storefront/current/build/assets/;
}
```

```sh
nginx -t && nginx -s reload
```

## What not to do

- Mismatched slashes the other way: `location /assets` with `alias …/assets/`. The assets load, but `/assets../.env` then reads the build's `.env` beside them: the well-known "off-by-slash" leak. The check tries it. (Both without a slash is safe, and so is `root …/build;` inside the location.)
- Copying the assets into `public/`. The next deploy's assets are missing again; the check adds a file to the release and expects it served.
