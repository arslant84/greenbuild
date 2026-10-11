#!/bin/sh
# Reference fix used by CI: point the app back at the IPv4 loopback nginx uses, then restart it as its user.
set -eu

env_file=$(ls /etc/*/app.env | head -n 1)
app=$(basename "$(dirname "$env_file")")
sed -i 's/^LISTEN_ADDR=.*/LISTEN_ADDR=127.0.0.1/' "$env_file"
pkill -u "$app" httpd
su -s /bin/sh "$app" -c "/opt/$app/start.sh"
sleep 1
