#!/bin/sh
# Reference fix used by CI: stop the retired scheduler, so init collects its zombie children, and the
# warm-up loop that waits for a cache that moved.
set -eu

pkill -f 'tail -f /var/log/reports/queue.log'
pkill -f cache-warmup
sleep 1
