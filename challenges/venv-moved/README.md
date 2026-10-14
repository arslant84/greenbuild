# Not found, but right there

## What was broken

The release pipeline built the service's virtualenv in a scratch directory (`/opt/build-<n>/venv`), copied it to `/srv/<app>/venv` and removed the scratch directory. A virtualenv records its absolute path: every script in `bin/` starts with `#!/opt/build-<n>/venv/bin/python3`. That interpreter is gone, so starting `/srv/<app>/venv/bin/acme-reports` fails with `No such file or directory`, although the script itself exists.

## How to find it

- `/var/log/<app>/app.log`: `nohup: can't execute '/srv/<app>/venv/bin/acme-reports': No such file or directory`.
- `head -1 /srv/<app>/venv/bin/acme-reports` shows the old path; `pyvenv.cfg` shows the build command.
- `/var/log/deploy/release.log` shows the build, the copy and the clean-up.

## The fix

```sh
python3 -m venv --clear /srv/reports/venv
/srv/reports/venv/bin/python -m pip install --no-index --find-links /opt/wheels acme-reports
reports-start
```

Rewriting the scripts' first lines to the new path works too, but a rebuild leaves nothing else pointing at the old place.

## What not to do

- Bringing back `/opt/build-<n>` (a copy or a symlink): the next clean-up breaks the service again.
- Installing the service into the system Python and starting it from there: the release no longer runs on its own virtualenv.
- Starting it as root.
