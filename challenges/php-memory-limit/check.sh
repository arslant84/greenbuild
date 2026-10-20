#!/bin/sh
# Exit 0 when the export answers through the site with every row, and the app's pool runs with a sane
# memory limit: enough for the export, not unlimited. The output is shown to the player: what is wrong,
# never how.
set -u

readonly LIMIT_MIN_MB=128
readonly LIMIT_MAX_MB=512

app=$(ls /srv | grep -E '^(reports|invoices|payroll)$' | head -n 1)
public="/srv/$app/public"

if [ -z "$app" ] || ! pgrep -f "nginx: master" > /dev/null || ! pgrep -f "php-fpm: master" > /dev/null; then
  echo "the site is not running"
  exit 1
fi
if ! pgrep -u "$app" -f "php-fpm: pool $app" > /dev/null; then
  echo "the app's PHP pool does not run as its user"
  exit 1
fi

rows=$(sed -n 's/^const ROWS = \([0-9]*\);$/\1/p' "$public/export.php")
if [ "$(curl -s --max-time 10 http://127.0.0.1/export.php)" != "rows,$rows" ] || [ -z "$rows" ]; then
  echo "the export still fails"
  exit 1
fi

# The pool's effective limit, as the app sees it.
probe="$public/greenbuild-probe-$$.php"
echo '<?php echo ini_get("memory_limit");' > "$probe"
limit=$(curl -s --max-time 3 "http://127.0.0.1/$(basename "$probe")")
rm -f "$probe"
megabytes=$(echo "$limit" | sed -n 's/^\([0-9][0-9]*\)M$/\1/p')
if [ -z "$megabytes" ] || [ "$megabytes" -lt "$LIMIT_MIN_MB" ] || [ "$megabytes" -gt "$LIMIT_MAX_MB" ]; then
  echo "the app's memory limit is not a sane value"
  exit 1
fi
echo "the export answers with every row"
