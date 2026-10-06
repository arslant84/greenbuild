# The restore went fine, they said

## What was broken

Last night's restore unpacked the backup as root with `tar --no-same-owner --no-same-permissions`. Every file of the cluster in `$PGDATA` (`/var/lib/postgresql/17/main`) ended up owned by root, and the directory itself got mode 0755. PostgreSQL refuses both: it must run as the owner of its data directory, and the directory may not be open to other users.

## How to find it

- `pg_ctl status` (as `postgres`) says no server is running.
- `/var/log/postgresql/postgresql.log` ends with `could not open configuration file ".../postgresql.conf": Permission denied`: the `postgres` user cannot read its own files.
- After a `chown`, the next start fails with `data directory ... has invalid permissions`, which names the modes it accepts (0700 or 0750).
- `ls -ld $PGDATA` shows `root root` and `drwxr-xr-x`.
- `/root/restore.log` shows the `tar` options that dropped owners and modes.

## The fix

```sh
chown -R postgres:postgres "$PGDATA"
chmod 0700 "$PGDATA"
su postgres -c "pg_ctl -D $PGDATA -l /var/log/postgresql/postgresql.log start"
```

## What not to do

- Starting PostgreSQL as root: it refuses, on purpose.
- `chmod -R 777`: PostgreSQL refuses a data directory others can read, and so should you.
- Running `initdb` again: the server starts, but the restored data is gone. The check looks for the restored orders.
- Restoring a database with `tar` as root without `--same-owner` (`-p` for modes): `pg_basebackup` or `pg_dump`/`pg_restore` avoid the problem.
