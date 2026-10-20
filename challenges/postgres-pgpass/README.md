# No password supplied

## What was broken

Configuration management now writes the backup user's files (CFG-718), and it wrote `~/.pgpass` with mode `0644`. libpq ignores a password file that others can read (`WARNING: password file "/home/backup/.pgpass" has group or world access`), so `pg_dump --no-password` has no password: `fe_sendauth: no password supplied`.

Behind it is a second trap: the file's entry names `localhost`, but the job connects to `127.0.0.1`. libpq compares host names literally, so even a private file does not match.

## How to find it

- `/var/log/backup/dump.log`: the warning and the error; `/var/log/backup/ops.log`: the change.
- Run the job as its user: `su backup -c nightly-dump`, then read the log again after each fix.
- `ls -l /home/backup/.pgpass`, and compare its first field with the job's `-h`.

## The fix

```sh
chmod 600 /home/backup/.pgpass
sed -i 's/^localhost:/127.0.0.1:/' /home/backup/.pgpass
```

## What not to do

- `trust` in `pg_hba.conf`: anyone on the host could then log in as any role.
- `PGPASSWORD` in the job, or editing the job: the check runs it as shipped.
- Leaving the file readable by others.
