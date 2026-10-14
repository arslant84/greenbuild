# Hints

## Hint 1

The export writes its log under `/var/log/`. What does each night's run say, and how does that differ from running the export yourself?

## Hint 2

cron does not start jobs from your login shell: a job gets only the environment cron gives it, and root's crontab sets that environment itself since the hardening. Where does the export live, and is that directory on the jobs' `PATH`?

## Hint 3

Make cron find the export: either add its directory to the `PATH` line in root's crontab or call it by its full path in the job. Keep the job scheduled as it is.
