#!/bin/sh
# Reference fix used by CI: have logrotate create the new log for the worker's user, and give tonight's
# empty log back to it.
set -eu

app=$(ls /etc/logrotate.d | grep -E '^(ingest|mailer|billing)$')
sed -i "s/^    create 0640 root root\$/    create 0640 $app $app/" "/etc/logrotate.d/$app"
chown "$app:$app" "/var/log/$app/$app.log"
