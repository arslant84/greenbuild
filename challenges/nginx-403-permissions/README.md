# The site answers 403 Forbidden

## What was broken

The deploy ran with `umask 077`, so the site directory was created `0700` and the page `0600`, both owned by the deploy user. nginx's master process runs as root, but the workers that serve requests run as the unprivileged `nginx` user. They could neither enter the directory nor read the page, so nginx answered `403 Forbidden`.

## How to find it

- `tail /var/log/nginx/error.log` shows `open() ".../index.html" failed (13: Permission denied)`: a permissions problem, not a missing file.
- `ps -o user,args | grep nginx` shows the workers run as `nginx`.
- `ls -ld /srv/www/*` and `ls -l /srv/www/*/index.html` show `drwx------` and `-rw-------` owned by the deploy user.

## The fix

Give the workers read access without giving away more:

```sh
chmod 0755 /srv/www/<site>
chmod 0644 /srv/www/<site>/index.html
```

nginx reads the file on each request, so no reload is needed. A deploy should run with a sane umask (`022`) or set modes explicitly.

## What not to do

- `user root;` in `nginx.conf` makes every request run with full privileges.
- `chmod -R 777` lets any process on the machine rewrite the site.
