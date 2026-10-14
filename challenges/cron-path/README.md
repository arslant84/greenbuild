# Not found, every night

## What was broken

The hardening (SEC-1207) put `PATH=/usr/bin:/bin` at the top of root's crontab, a minimal environment for scheduled jobs. The export script lives in `/usr/local/bin`, which an interactive shell has on its `PATH` but cron's jobs now do not, so every night the job fails with `sh: <report>-export: not found` and no report is written.

## How to find it

- `/var/log/reports/export.log` shows `not found` for each night.
- `which <report>-export` in a shell finds `/usr/local/bin/<report>-export`; `crontab -l` shows the `PATH` line without that directory.
- `env -i PATH=/usr/bin:/bin sh -c '<report>-export'` reproduces the failure.

## The fix

```sh
sed -i 's#^PATH=/usr/bin:/bin$#PATH=/usr/local/bin:/usr/bin:/bin#' /etc/crontabs/root
```

or call the job by its full path, `/usr/local/bin/<report>-export`.

## What not to do

- Running the export by hand: tonight's run would fail again.
- Removing the job, or moving it to a schedule nobody asked for.
