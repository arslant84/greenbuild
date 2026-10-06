# Hints

## Hint 1

A 502 means nginx could not reach the app behind it. Is the app running? `appctl status` tells you, and the app writes a log under `/var/log`.

## Hint 2

The app refuses to start because a setting is missing. Compare its environment file in `/etc` with what version 2.0 expects: the release notes are next to the app in `/srv`.

## Hint 3

Fix the setting where the app reads it, so it starts the same way after every restart, then start it with `appctl`. Starting it by hand with the right variable would not survive the next restart.
