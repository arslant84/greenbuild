# Hints

## Hint 1

`pg_stat_activity` lists every connection: who holds it, from where, and whether it does anything. Count them by user and compare with `SHOW max_connections`.

## Hint 2

Closing connections helps only until their owner opens them again. Read the reporting worker's script and settings: how many does it keep, and what does it do when it loses them?

## Hint 3

Keep the worker, but make sure it can never take every slot: PostgreSQL can limit how many connections one role may hold, or the worker can keep a smaller pool. Then free the slots it holds now.
