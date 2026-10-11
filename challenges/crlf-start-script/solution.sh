#!/bin/sh
# Reference fix used by CI: strip the carriage returns from the start script, then run it as the deploy
# hook does.
set -eu

script=$(ls /opt/*/start.sh | head -n 1)
app=$(basename "$(dirname "$script")")
sed -i 's/\r$//' "$script"
su -s /bin/sh "$app" -c "$script"
sleep 1
