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
# Python starts slowly under gVisor; wait until the app answers, up to 10 s.
port=$(sed -n 's/^# Starts .* on port \([0-9]*\);.*/\1/p' "/usr/local/bin/$app-start")
for _ in $(seq 50); do
  wget -q -T 1 -O /dev/null "http://127.0.0.1:$port/ready" 2> /dev/null && break
  sleep 0.2
done
