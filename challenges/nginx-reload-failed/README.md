# Deployed, but still yesterday

## What was broken

The deploy rewrote `/etc/nginx/conf.d/site.conf` to serve the new release and ran `nginx -s reload`. The reload failed: the docs team had added a redirect to `/etc/nginx/snippets/legacy-redirects.conf` the day before without a semicolon, and nobody had reloaded since. nginx refuses a configuration that does not parse and keeps running the old one, so the site still served yesterday's release. The deploy did not look at the reload's exit code and reported success.

## How to find it

- The configuration on disk names the new release; the site shows the old one.
- `/var/log/deploy.log` contains `nginx: [emerg] ... in /etc/nginx/snippets/legacy-redirects.conf`.
- `nginx -t` points at the file and line: the `return` in `location = /faq` has no `;`, so nginx reads the `}` as one of its arguments.

## The fix

```sh
vi /etc/nginx/snippets/legacy-redirects.conf   # return 301 /docs/faq;
nginx -t && nginx -s reload
```

## What not to do

- Deleting the snippet: the reload passes, but the legacy links stop redirecting; the check follows them.
- Restarting nginx without testing: the broken configuration stops it from coming back at all.
- Deploying again: the deploy fails the same way, just as silently.
