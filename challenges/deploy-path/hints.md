# Hints

## Hint 1

The pipeline keeps its output in `/var/log/deploy/`. Which command did the deploy script fail to find?

## Hint 2

A shell finds commands through `PATH`. Read `/usr/local/bin/deploy` from the top: what does it set `PATH` to, and where do `date`, `tar` and `nginx` live (`which date`)?

## Hint 3

Keep the vetted tools first, but add the system directories after them: `PATH=/opt/deploy/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`. Then ship the release with `deploy /var/deploy/incoming/<artifact>`.
