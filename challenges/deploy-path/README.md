# Release that never shipped

## What was broken

OPS-388 asked the deploy script to prefer the team's vetted tools in `/opt/deploy/bin`. The change replaced `PATH` instead of prepending to it, so the script can no longer find `date`, `tar`, `nginx` or anything else from the system. Last night's pipeline run stopped at the first of them (`date: not found`), before it unpacked the release, and the site kept serving the previous version.

## How to find it

- The site shows the old version; `/var/deploy/incoming/` holds the new release.
- `/var/log/deploy/pipeline.log` ends with `date: not found` and the failed exit code.
- `/usr/local/bin/deploy` sets `PATH=/opt/deploy/bin`, and only `notify` lives there.

## The fix

```sh
# in /usr/local/bin/deploy:
PATH=/opt/deploy/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
deploy /var/deploy/incoming/<site>-<version>.tar.gz
```

## What not to do

- Unpacking the release by hand: the site comes back tonight, and tomorrow's deploy fails again. The check runs the script itself.
- Deleting the `PATH` line: the pipeline runs with an almost empty environment, so the script would not find `notify` either.
- `PATH=$PATH:/opt/deploy/bin`: it works, but the system tools now win over the vetted ones, which is what OPS-388 wanted to avoid.
