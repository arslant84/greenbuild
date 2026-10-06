# Hints

## Hint 1

Compare `/var/log/nginx/access.log` with the other files next to it, and check their times with `ls -l --full-time`. Which one grows when you `wget` the site?

## Hint 2

A process writes to the file it opened, not to a name. Renaming the file does not move the writer: nginx keeps writing into the renamed log until it is told to open its logs again. `/etc/logrotate.d/nginx` decides what happens at rotation.

## Hint 3

Make the rotation tell nginx to reopen its logs: a `postrotate` block that runs `nginx -s reopen` (with `sharedscripts`, once for all logs). Then run `nginx -s reopen` once by hand, and test with `logrotate -f /etc/logrotate.conf`.
