#!/bin/sh
# Exit 0 when no process is a zombie, nothing keeps a CPU busy, and nightly-report renders every
# region. The output is shown to the player: what is wrong, never how.
set -u

readonly SAMPLE_SEC=2
# A process using more than a quarter of a CPU over the sample is busy, not idle.
readonly BUSY_TICKS=50

# cpu_ticks prints "pid ticks" for every process: user plus system time, from /proc/<pid>/stat.
cpu_ticks() {
  for stat in /proc/[0-9]*/stat; do
    awk '{ sub(/^.*\) /, ""); print FILENAME, $12 + $13 }' "$stat" 2> /dev/null
  done | sed 's#/proc/\([0-9]*\)/stat#\1#'
}

if [ "$(ps -o stat | grep -c '^Z')" -gt 0 ]; then
  echo "defunct processes are still waiting to be collected"
  exit 1
fi

work=$(mktemp -d)
cpu_ticks > "$work/before"
sleep "$SAMPLE_SEC"
cpu_ticks > "$work/after"
busy=$(awk -v self="$$" -v limit="$BUSY_TICKS" 'NR == FNR { start[$1] = $2; next } ($1 in start) && $1 != self && $2 - start[$1] > limit' "$work/before" "$work/after")
if [ -n "$busy" ]; then
  echo "a process keeps a CPU busy"
  exit 1
fi

if ! su -s /bin/sh reports -c "nightly-report" > /dev/null 2>&1; then
  echo "nightly-report still fails"
  exit 1
fi

echo "the reports run again"
