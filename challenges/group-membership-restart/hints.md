# Hints

## Hint 1

The service logs every failed upload. Compare the times of the failures with the time of the change ops made in `/var/log/ops.log`.

## Hint 2

Compare what `id` says about the service's user with the groups the running process actually has; the process's status lives under `/proc/<pid>/`.

## Hint 3

A process gets its groups when it starts and keeps them. Use the service's own start script to make it pick up the new membership.
