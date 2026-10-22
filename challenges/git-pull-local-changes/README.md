# The deploy job won't pull

## What was broken

Last night's incident (INC-5521) was fixed by editing `config/app.ini` in place on the server. Tonight's release changes the same file, and it carries the same hotfix. The deploy job runs `git pull --ff-only`, and git refuses to overwrite an uncommitted local change: "Your local changes to the following files would be overwritten by merge … Aborting". Every run fails and the server stays on yesterday's release.

## How to find it

- `/var/log/<app>/deploy.log`: the refusal and the file it names.
- `git -C /srv/<app> status` and `git diff`, as the deploy user: the local edit.
- `git -C /srv/<app> fetch` then `git diff HEAD origin/main -- config/app.ini`: the release already sets the same value.
- `/var/log/ops.log`: what was changed by hand, and why.

## The fix

The release contains the hotfix, so the local edit can go:

```sh
su -s /bin/sh deploy -c 'git -C /srv/<app> checkout -- config/app.ini && /usr/local/bin/<app>-deploy'
```

## What not to do

- Committing the edit on the server: the checkout then diverges from `main`, and `--ff-only` refuses every release after it.
- `git stash`, pull, `git stash pop`: the pop conflicts with the release's identical change and leaves the checkout dirty. Drop the stash instead.
- Rewriting the job to `git reset --hard origin/main`: it would silently destroy the next hand edit instead of reporting it. The check runs the job as shipped.
- Running git as root in the deploy user's checkout.
- Losing the hotfix's value: the check wants it in place.
