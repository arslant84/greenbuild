#!/bin/sh
# Reference fix used by CI: let cron's minimal PATH include /usr/local/bin, where the export lives.
set -eu

sed -i 's#^PATH=/usr/bin:/bin$#PATH=/usr/local/bin:/usr/bin:/bin#' /etc/crontabs/root
