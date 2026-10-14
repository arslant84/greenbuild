#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

report=$(echo "sales inventory payroll" | cut -d' ' -f $((seed % 3 + 1)))
hour=$((1 + seed % 4))
out="/srv/exports/$report"

mkdir -p "$out" /var/log/reports
cat > "/usr/local/bin/$report-export" <<SCRIPT
#!/bin/sh
# $report-export: writes today's $report report to $out (installed by the reports package).
set -eu
day=\$(date -u +%F)
printf 'report=%s day=%s rows=%s\n' "$report" "\$day" "$((100 + seed % 900))" | gzip > "$out/$report-\$day.txt.gz"
echo "\$(date -u +%FT%TZ) exported $out/$report-\$day.txt.gz"
SCRIPT
chmod 0755 "/usr/local/bin/$report-export"

# Last week's hardening (SEC-1207): cron jobs get a minimal PATH. Nobody noticed the export lives in /usr/local/bin.
cat > /etc/crontabs/root <<CRON
# SEC-1207: minimal environment for scheduled jobs.
PATH=/usr/bin:/bin
SHELL=/bin/sh

# min hour day month weekday command
0 $hour * * * $report-export >> /var/log/reports/export.log 2>&1
CRON

# The last nights, as cron ran them.
for night in 3 2 1; do
  env -i PATH=/usr/bin:/bin HOME=/root sh -c "$report-export" >> /var/log/reports/export.log 2>&1 || true
done
crond -b -l 8
rm -f "$0"
