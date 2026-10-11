# Hardened out of its own database

## What was broken

The hardening rewrote `pg_hba.conf` so that TCP connections are accepted only over TLS (`hostssl ... 127.0.0.1/32 scram-sha-256`) and everything else is rejected. This server has no certificate and `ssl = off`, so no connection can ever match the `hostssl` line; the app's plain TCP connection falls through and is refused: `FATAL: no pg_hba.conf entry for host "127.0.0.1", user "<role>", database "<db>", no encryption`.

## How to find it

- `/var/log/app/app.log`: the FATAL message, ending in `no encryption`.
- `$PGDATA/pg_hba.conf`: the `hostssl` line and the catch-all `reject`.
- `psql -c 'show ssl'` as postgres: `off`.

## The fix

Either let loopback TCP connections authenticate without TLS, still by password:

```sh
su postgres -c "vi $PGDATA/pg_hba.conf"       # hostssl -> host on the 127.0.0.1/32 line
su postgres -c "pg_ctl -D $PGDATA reload"
```

or give the server a certificate and turn `ssl = on`, so the `hostssl` line matches. On one host, over loopback, the first is what the hardening should have done.

## What not to do

- `trust`: anyone who knows the user name gets in; the check tries a wrong password.
- Removing the `reject` line or opening `0.0.0.0/0`: it does not fix the app and widens access.
- Forgetting the reload: PostgreSQL keeps the old rules until it reloads.
- `sed -i` as root: it replaces the file with a new one owned by root and readable only by root. PostgreSQL cannot read it, keeps the old rules and logs `pg_hba.conf was not reloaded`. Edit as postgres, or give the file back (`chown postgres:postgres`).
