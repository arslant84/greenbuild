# Hints

## Hint 1

nginx's error log in `/var/log/nginx/` names the address it tries to reach and what happens there. Compare it with where the app actually listens: `netstat -ltnp` lists every listening socket with its address.

## Hint 2

"localhost" is two addresses: `127.0.0.1` and `::1`. A socket bound to one does not answer on the other. What changed in the app's latest release, and where does it read its settings?

## Hint 3

Change the app's listen address in its settings to the one nginx uses, then restart the app the way it runs: its start script, as its own user.
