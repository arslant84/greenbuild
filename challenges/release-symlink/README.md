# Nothing to see here

## What was broken

The site is deployed Capistrano-style: every deploy builds into `/srv/<app>/releases/<timestamp>`, and nginx serves `/srv/<app>/current`, a symlink to the live release. Last night's deploy switched `current` to its new release *before* building it (bug DEP-118). The build then ran out of memory, and the cleanup step deleted the release, leaving `current` pointing at a folder that no longer exists. nginx answers 404 for everything.

There is a trap: the newest folder in `releases/` is a build that failed the night before and was kept for debugging. It has no page either.

## How to find it

- `/var/log/nginx/error.log`: `"/srv/<app>/current/index.html" is not found (2: No such file or directory)` (other pages: `open() ... failed (2: ...)`).
- `ls -l /srv/<app>/` shows `current -> /srv/<app>/releases/<timestamp>`, and that folder is missing.
- `/var/log/deploy/deploy.log` lists each deploy: two `build ok`, then two failures, the last one removed by its cleanup.

## The fix

```sh
cd /srv/<app>
ln -sfn /srv/<app>/releases/<last good> current.new
mv -T current.new current      # rename(2) swaps the link atomically
```

## What not to do

- Pointing `current` at the newest folder: it is the failed build, with no page.
- Pointing it at an older good release: the site would go back further than it needs to.
- Copying a release into a real `current` folder: the next deploy and every rollback expect a symlink.
- `rm current && ln -s ...`: between the two commands the site has no root at all.
