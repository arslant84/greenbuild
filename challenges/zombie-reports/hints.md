# Hints

## Hint 1

`ps -o pid,ppid,user,stat,args` shows every process with its parent. How many are in state `Z`, and which process is their parent? `top` shows which one keeps a CPU busy.

## Hint 2

A zombie has already exited; it keeps its PID until its parent collects its exit status. You cannot kill a zombie, and every zombie still counts against the limit on processes, which is why new processes cannot start. When a parent dies, init (PID 1) adopts its children and collects them.

## Hint 3

The parent of the zombies is the retired `report-scheduler`, now running as `tail -f .../queue.log`: stop it, and init collects its children. Stop `cache-warmup` too: it waits forever for a cache that moved. Then run `nightly-report`.
