# Hints

## Hint 1

The app's log under `/var/log` says why it stops right after `appctl start`. Error 24 is `EMFILE`: the process may not open another file.

## Hint 2

Every process has a limit on open files (`ulimit -n` in a shell, "Max open files" in `/proc/<pid>/limits`). Look at how `appctl` starts the app and where its limit comes from.

## Hint 3

The app opens one log per customer, and there are now more customers than its limit allows. Raise the limit in the app's environment file, then start it with `appctl`. Removing customers is not a fix.
