# Hints

## Hint 1

The dump logs what `pg_dump` said under `/var/log/backup/`. Read every line, not only the last: is there a warning before the error? Run the job yourself as the backup user to see it again.

## Hint 2

libpq, the library behind `pg_dump` and `psql`, is strict about `~/.pgpass`: it ignores the file when other users can read it. Look at the file's mode.

## Hint 3

Once the file is private, libpq still has to match an entry: `host:port:database:user:password`, compared literally with what the job asks for. Compare the entry's host with the job's `-h`.
