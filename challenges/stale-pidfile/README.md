# Already running, says the dead app

## What was broken

The app was killed overnight (`Killed (signal 9), out of memory` in its crash log), so it never removed its pid file. The nightly backup started later and got the same process id. `appctl start` checks the pid file with `kill -0`, finds a live process and refuses to start the app: "already running". nginx has nothing to proxy to and answers 502.

## How to find it

- `appctl start` and `/var/log/<app>/appctl.log`: "already running (pid N)".
- `ps` or `cat /proc/N/cmdline`: pid N is `nightly-backup`, run by the `backup` user, not the app.
- `/var/log/<app>/crash.log`: the app was killed, so nothing removed its pid file.

## The fix

```sh
rm /run/<app>/<app>.pid
appctl start
```

## What not to do

- Killing pid N: it is the nightly backup, which has nothing to do with the app; the check makes sure it still runs.
- Starting `httpd` by hand: the pid file would still name the backup, and the next `appctl` call would act on the wrong process.
