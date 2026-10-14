# Hints

## Hint 1

The app's log says the password is wrong, but nobody changed it. The client only ever hears "password authentication failed"; PostgreSQL's own log under `/var/log/postgresql/` says more about each refusal.

## Hint 2

A role can carry an expiry date for its password (`VALID UNTIL`). After it passes, the right password is refused like a wrong one. `\du` in `psql` (as the `postgres` user) shows each role's expiry.

## Hint 3

Rotate the app's password with a new expiry (`ALTER ROLE … PASSWORD … VALID UNTIL …`, 90 days by the policy) and put the new password in the app's settings, or at least move the expiry far enough ahead. Trusting every connection or giving the app another role are not fixes.
