# Hints

## Hint 1

The price job logs what went wrong. Run the pricer yourself and read the error: which file is missing, and who needs it?

## Hint 2

Find where the library actually is, and compare that with where the dynamic loader looks by default. `/var/log/ops.log` says how the old version had installed it.

## Hint 3

On Alpine, the musl loader takes its search path from `/etc/ld-musl-<arch>.path`. That file replaces the default path rather than adding to it. After changing it, run the pricer and a common program such as `curl`.
