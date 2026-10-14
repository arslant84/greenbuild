# The password nobody changed

## What was broken

The security policy (SEC-1201) creates application roles with a password that is valid for 90 days (`VALID UNTIL`), to force rotation. Nobody rotated the app's password, and its validity ran out a few hours ago. PostgreSQL refuses an expired password with the same message as a wrong one, `password authentication failed for user "<db>_app"`, so the app's log points at a password nobody changed. Only the server's log says why: `DETAIL: User "<db>_app" has an expired password.`

## How to find it

- `/var/log/app/app.log`: `FATAL: password authentication failed for user "<db>_app"`.
- `/var/log/postgresql/postgresql.log`: the same line with `DETAIL: User "<db>_app" has an expired password.`
- `su postgres -c "psql -c '\du'"` shows `Password valid until <a few hours ago>`.

## The fix

```sh
su postgres -c "psql -c \"alter role orders_app password '<new>' valid until '<today + 90 days>'\""
sed -i 's/^PGPASSWORD=.*/PGPASSWORD=<new>/' /etc/app/db.env
```

Moving only the expiry ahead (`valid until 'infinity'` or a later date) lets the app in too, but skips the rotation the policy wants.

## What not to do

- `trust` in `pg_hba.conf`: anyone who knows the role's name gets in.
- Giving the app the `postgres` role or making its role a superuser.
- An expiry a day or two ahead: the app breaks again in the night.
