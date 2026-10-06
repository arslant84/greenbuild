#!/bin/sh
# Reference fix used by CI: raise the app's open-file limit, then start it.
set -eu

. /etc/appctl.conf
sed -i 's/^LIMIT_NOFILE=.*/LIMIT_NOFILE=4096/' "/etc/$APP/$APP.env"
appctl start
