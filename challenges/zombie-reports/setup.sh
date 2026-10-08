#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

dispatched_jobs=$((100 + seed % 11))
printf 'DISPATCHED_JOBS=%s\n' "$dispatched_jobs" > /etc/report-scheduler.conf

# Both were left running after the move to nightly-report.
su -s /bin/sh reports -c "nohup report-scheduler > /dev/null 2>&1 &"
su -s /bin/sh reports -c "nohup cache-warmup > /dev/null 2>&1 &"

# Wait for the dispatched renders to finish and turn into zombies, then fail last night's run.
sleep 4
su -s /bin/sh reports -c "nightly-report" > /dev/null 2>&1 || true
rm -f "$0"
