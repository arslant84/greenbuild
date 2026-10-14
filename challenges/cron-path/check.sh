#!/bin/sh
# Exit 0 when the export is still scheduled in root's crontab and, run the way cron runs it (only the
# crontab's own PATH, no login shell), writes today's report. The output is shown to the player: what is
# wrong, never how.
set -u

crontab=/etc/crontabs/root
job=$(grep -v '^ *#' "$crontab" 2> /dev/null | grep -E '^[0-9*]+ +[0-9*]+ +[0-9*]+ +[0-9*]+ +[0-9*]+ +.*-export' | head -n 1)
report=$(ls /srv/exports 2> /dev/null | head -n 1)
# cron's PATH: the crontab's own assignment, or busybox crond's default.
path=$(sed -n 's/^ *PATH *= *//p' "$crontab" 2> /dev/null | tail -n 1)
[ -n "$path" ] || path=/usr/bin:/bin

if ! pgrep crond > /dev/null; then
  echo "cron is not running"
  exit 1
fi
if [ -z "$job" ] || [ -z "$report" ]; then
  echo "the nightly export is no longer scheduled"
  exit 1
fi
command=$(echo "$job" | sed -E 's/^[^ ]+ +[^ ]+ +[^ ]+ +[^ ]+ +[^ ]+ +//')
today="/srv/exports/$report/$report-$(date -u +%F).txt.gz"
rm -f "$today"
env -i PATH="$path" HOME=/root SHELL=/bin/sh sh -c "$command" > /dev/null 2>&1
if [ ! -s "$today" ] || ! gzip -dc "$today" 2> /dev/null | grep -q "^report=$report "; then
  echo "the scheduled export still writes no report"
  exit 1
fi
echo "the nightly export works again"
