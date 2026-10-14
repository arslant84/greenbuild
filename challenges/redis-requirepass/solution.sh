#!/bin/sh
# Reference fix used by CI: give the app the cache's password, keep its settings private, restart it.
set -eu

app=$(ls /opt | grep -v greenbuild | head -n 1)
password=$(sed -n 's/^requirepass //p' /etc/redis.conf)
echo "REDIS_PASSWORD=$password" >> "/etc/$app/app.env"
chmod 0600 "/etc/$app/app.env"
pkill -f "/opt/$app/app.py"
sleep 1
"$app-start"
sleep 2
