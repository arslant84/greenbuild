# Hints

## Hint 1

The app's log under `/var/log` says why it will not start. Then find out who is holding what it needs: `netstat -ltnp` lists every listening port and the process behind it.

## Hint 2

Stopping that process is not enough if something brings it back a few seconds later. `ps -ef` shows the whole process list, including whatever keeps restarting it.

## Hint 3

Stop what keeps the old server alive and the server itself, then start the app with `appctl`. Check again after a few seconds that the app still owns its port.
