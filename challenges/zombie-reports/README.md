# The undead and the busy

## What was broken

The retired `report-scheduler` v1 was left running after `nightly-report` replaced it. It starts one background render per queued job and then `exec`s into `tail -f` on the queue log, so nothing ever collects its children: each finished render stays a zombie (`<defunct>`, state `Z`). About 100 zombies take up the sandbox's limit of 256 processes, so `nightly-report`, which runs 80 renders at once (two processes each), fails with `Resource temporarily unavailable` ("can't fork"). Next to it, a one-off `cache-warmup` busy-waits for a cache file that moved, using a whole CPU share.

## How to find it

- `nightly-report` fails; `/var/log/reports/nightly.log` shows `Resource temporarily unavailable` and fewer than 80 regions rendered.
- `ps -o pid,ppid,stat,args | grep -c ' Z '` counts the zombies; their PPID is the `tail -f /var/log/reports/queue.log` process, started as `report-scheduler`.
- `top` shows `cache-warmup` near the CPU limit; its script waits for `/var/cache/reports/ready`, which nothing creates.

## The fix

```sh
pkill -f 'tail -f /var/log/reports/queue.log'   # the scheduler: init (tini, PID 1) collects its zombies
pkill -f cache-warmup
nightly-report
```

## What not to do

- `kill -9` on the zombies: they have already exited; only their parent (or init, once the parent is gone) can collect them.
- Raising the process limit: the zombies keep piling up with every dispatch.
- Creating `/var/cache/reports/ready` by hand: the loop ends, but the next warm-up would spin the same way; the job is retired.
