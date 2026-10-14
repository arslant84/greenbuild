# Hints

## Hint 1

Compare what nginx answers for `/` and for an address like `/orders/1042` (use the site's name as the `Host` header). The site's access log under `/var/log/nginx/` shows the same. Which files exist under the site's root?

## Hint 2

The app is a single page: `index.html` and a script whose router reads the address in the browser. No file exists for `/orders/1042`. The old Apache host knew that; look at what it left in the site's root.

## Hint 3

nginx needs the same rule as Apache's `FallbackResource`: serve the file if it exists, otherwise `index.html` (`try_files` in a `location /`). Keep the API's location as it is, so its errors still reach the browser, then `nginx -t` and reload.
