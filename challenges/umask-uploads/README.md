# Forbidden since Tuesday

## What was broken

On Tuesday the upload service got a stricter umask (`UMASK=0077`, "customer uploads must not be readable by other users"). Every file it has stored since is `-rw-------`, readable only by the service's user. nginx's workers run as `nginx` and cannot open them: `open() "/srv/uploads/upload-1.txt" failed (13: Permission denied)` and a 403. Files from before Tuesday are `-rw-r--r--` and still work.

## How to find it

- `/var/log/nginx/error.log`: `Permission denied` for the new files only.
- `ls -l /srv/uploads`: old files `0644`, new files `0600`, all owned by the service.
- `/etc/<service>/<service>.env`: `UMASK=0077` with the SEC-2201 note; the service's script applies it with `umask`.

## The fix

```sh
sed -i 's/^UMASK=.*/UMASK=0022/' /etc/<service>/<service>.env
pkill -u <service> -f /usr/local/bin/<service>
su -s /bin/sh <service> -c "nohup <service> >/dev/null 2>&1 &"
chmod 0644 /srv/uploads/*
```

If the files really must not be readable by every user, the better fix keeps that intent: a group the service and nginx share (`UMASK=0027`, the store in that group with the setgid bit).

## What not to do

- `chmod 644` on today's files alone: the service still runs with `0077`, so the next upload is forbidden again; the check sends one.
- `chmod 777` or `UMASK=0000`: any user could change the uploads; the check refuses world-writable files.
- Running nginx as root to read everything: it removes the separation nginx's workers rely on.
