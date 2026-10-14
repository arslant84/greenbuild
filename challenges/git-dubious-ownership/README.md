# Merged, but not live

## What was broken

The site's checkout (`/srv/<site>`) and its origin belong to the `deploy` user. Since the server was rebuilt, the deploy job (`/usr/local/bin/deploy-<site>`) runs from root's crontab, and git refuses to work as root in a repository another user owns: `fatal: detected dubious ownership in repository at '/srv/<site>'`. Every deploy fails, so the release merged this morning never went live.

## How to find it

- `/var/log/deploy/<site>.log`: `deploy failed: fatal: detected dubious ownership in repository at '/srv/<site>'`.
- `/etc/crontabs/root` runs the deploy job; `ls -ld /srv/<site>` shows `deploy` as the owner.
- `git -C /srv/git/<site>.git log` shows the new release; `public/VERSION` in the checkout still shows the old one.

## The fix

```sh
git config --global --add safe.directory /srv/docs   # trust exactly this checkout, for root
deploy-docs
```

Running git as the owner in the deploy job (`su -s /bin/sh deploy -c 'git pull …'`) is a fix too.

## What not to do

- `safe.directory '*'`: root then trusts any repository, including one a user plants to run hooks or config as root.
- `chown -R root /srv/<site>`: the checkout is no longer the deploy user's.
- Pulling once by hand: the next release is stuck again; the check pushes one and runs the job.
