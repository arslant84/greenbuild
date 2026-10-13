# Read-only since the restore

## What was broken

The restore ran as root: it kept the database file's owner (`cp -p`) but recreated `/var/lib/<app>` itself, which is now `root:root 0755`. SQLite writes a rollback journal (`<app>.db-journal`) next to the database for every change, so the app's user can still read and open the file but cannot create the journal: every save fails with `unable to open database file`, while pages that only read keep working.

## How to find it

- `/var/log/<app>/app.log` shows `save failed: unable to open database file` for each save.
- `ls -ld /var/lib/<app> /var/lib/<app>/<app>.db`: the file is the app's, the directory is root's.
- `/var/log/restore.log` says the restore ran as root.

## The fix

```sh
chown notes /var/lib/notes
```

No restart is needed: SQLite creates the journal on the next save.

## What not to do

- `chmod 777` on the directory or the file: every user could change or delete the app's data.
- Running the app as root: it hides the ownership problem and gives the app far more than it needs.
