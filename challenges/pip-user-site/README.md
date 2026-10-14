# Installed, but not for the app

## What was broken

The deploy ran `pip install --user … acme-invoice` as root. `--user` installs into the installing user's own site directory, `/root/.local/lib/python3.13/site-packages`, which only root's Python searches (and `/root` is private anyway). The app runs as its own user, so `import acme_invoice` fails with `ModuleNotFoundError` and the app exits at start, although the deploy log reports success.

## How to find it

- `/var/log/<app>/app.log`: `ModuleNotFoundError: No module named 'acme_invoice'`.
- `/var/log/deploy/deploy.log` shows `pip install --user` run by root.
- `pip show -f acme-invoice` as root shows the location under `/root/.local`.

## The fix

```sh
pip uninstall -y acme-invoice      # root's --user copy; with it, pip answers "already satisfied"
pip install --no-index --find-links /opt/wheels acme-invoice
billing-start
```

The trap: as root, a plain `pip install` finds the copy in root's user site and installs nothing system-wide. `pip install --ignore-installed` works too.

## What not to do

- Running the app as root.
- Opening `/root` to other users, or pointing the app's `PYTHONPATH` into root's home.
