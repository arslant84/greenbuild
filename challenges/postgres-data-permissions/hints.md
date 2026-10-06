# Hints

## Hint 1

PostgreSQL writes why it stops to its log in `/var/log/postgresql/`. `pg_ctl status -D <data directory>`, run as `postgres`, tells you whether it runs; `$PGDATA` names the directory.

## Hint 2

PostgreSQL refuses a data directory it does not own, or one other users can read. `ls -ld` and `ls -l` show who owns the directory and its files now; `/root/restore.log` shows how they got there.

## Hint 3

Give the whole data directory back to `postgres`, set the directory's mode to `0700`, and start the server as `postgres` with `pg_ctl`. Do not run `initdb` again: it would replace the restored data.
