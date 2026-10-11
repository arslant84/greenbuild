# Hints

## Hint 1

The app's log in `/var/log/app/` has PostgreSQL's exact refusal. It names the host, the user, the database and one more thing about the connection.

## Hint 2

`pg_hba.conf` in the data directory decides who may connect, how, and from where; the first matching line wins. Which line could match the app's connection, and what does it require that this server cannot offer? `SHOW ssl;` tells.

## Hint 3

Either give the server what the line demands, or make the line for local TCP connections accept connections without it while still asking for the password. Then reload PostgreSQL: it reads `pg_hba.conf` only at start and on reload.
