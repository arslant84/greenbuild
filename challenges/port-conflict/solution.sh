#!/bin/sh
# Reference fix used by CI: stop the leftover maintenance loop and its server, then start the app.
set -eu

pkill -f /root/maintenance.sh
pkill -f 'httpd .*-h /srv/maintenance/www' || true
sleep 1
appctl start
