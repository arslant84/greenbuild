# Hints

## Hint 1

`appctl` decides "already running" from a pid file. Read the script, then look at the process that pid belongs to: `ps`, or `/proc/<pid>/cmdline`.

## Hint 2

The app's own logs say how it ended overnight. A process that is killed outright cannot clean up after itself, and process ids are reused.

## Hint 3

The pid file is stale: it names another program. Leave that program alone, remove the stale file and start the app with its control script.
