# Silent since the rotation

## What was broken

The worker's log rotation was copied from a web server's template (OPS-977), including `create 0640 root root`. logrotate renames the log and creates a new, empty one owned by root with mode 0640. The worker runs as its own user and opens the log for every line, so from the first rotation on it cannot write: the new log stays empty and the lines are lost. The worker itself keeps running.

## How to find it

- `ls -l /var/log/<app>/`: the current log is empty and owned by root, while `.1` has the worker's lines up to the rotation.
- `ps -o user,args`: the worker runs as its own user, not root.
- `su -s /bin/sh <app> -c 'echo test >> /var/log/<app>/<app>.log'`: Permission denied.
- `/etc/logrotate.d/<app>` and `/var/log/ops.log`: the `create` line and where it came from.

## The fix

Make logrotate create the log for the worker's user, and give the current log back to it:

```sh
sed -i 's/create 0640 root root/create 0640 <app> <app>/' /etc/logrotate.d/<app>
chown <app>:<app> /var/log/<app>/<app>.log
```

`copytruncate` instead of `create` also works, at the cost of losing the lines written while the copy is taken.

## What not to do

- Fixing only the current file: tonight's rotation breaks it again. The check rotates once more.
- `create 0666` or a world-readable log: anyone on the host could read or forge the worker's log.
- Removing the rotation, or running the worker as root.
