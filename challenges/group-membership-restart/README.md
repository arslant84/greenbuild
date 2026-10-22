# In the group, still denied

## What was broken

The upload service runs as its own user and writes into `/srv/media/uploads`, which belongs to the thumbnailer and the `media` group (`2775`). The service's user was not in `media`, so uploads failed with Permission denied. Ops added it to the group (OPS-318), but a process gets its groups when it starts and keeps them. The running service still has only its own group, so uploads keep failing until it is restarted.

## How to find it

- `/var/log/<app>/upload.log`: `[Errno 13] Permission denied`, still after the change in `/var/log/ops.log`.
- `id <app>`: the user is in `media`.
- `grep Groups /proc/<pid>/status`: the running process is not.
- `ls -ld /srv/media/uploads`: the permissions are right for members of `media`.

## The fix

```sh
<app>-upload restart
```

## What not to do

- `chmod 777` or changing the directory's owner: everyone on the host could then write the shared uploads. The check wants `thumbs:media 2775` as it was.
- Running the service as root.
