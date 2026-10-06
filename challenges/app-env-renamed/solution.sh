#!/bin/sh
# Reference fix used by CI: give the setting its 2.0 name, then start the app.
set -eu

. /etc/appctl.conf
sed -i 's/^PORT=/LISTEN_PORT=/' "/etc/$APP/$APP.env"
appctl start
