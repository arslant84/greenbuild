# Zero visitors

## What was broken

Yesterday someone added `/etc/logrotate.d/nginx`: rotate daily, keep 14, `create` a fresh log. It has no `postrotate` step. logrotate renamed `access.log` to `access.log.1` and created an empty `access.log`, but nginx still holds the old file open and keeps writing into `access.log.1`. The dashboard reads `access.log`, which stays empty, so it shows zero visitors.

## How to find it

- `access.log` is empty or stale, while `access.log.1` keeps growing as you `wget` the site.
- `ls -l /proc/<nginx worker pid>/fd` (or `lsof`) shows nginx writing to `access.log.1`.
- `/etc/logrotate.d/nginx` has no `postrotate`, and no `copytruncate`.

## The fix

```sh
# in /etc/logrotate.d/nginx, inside the block:
#     sharedscripts
#     postrotate
#         nginx -s reopen
#     endscript
nginx -s reopen                      # move nginx to the new access.log now
logrotate -f /etc/logrotate.conf     # test a rotation
```

`copytruncate` also works: the file nginx holds is copied and then emptied, at the cost of losing the lines written between the two steps.

## What not to do

- Deleting the logrotate config: the log grows until the disk is full.
- Pointing the dashboard at `access.log.1`: tomorrow's rotation moves nginx to `access.log.2`.
- Restarting nginx after every rotation: `reopen` (`kill -USR1`) does it without dropping connections.
