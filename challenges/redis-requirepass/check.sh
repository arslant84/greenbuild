#!/bin/sh
# Exit 0 when the cache still asks for a password, the app runs as its own user and counts visits again,
# and its settings, now holding a secret, are not readable by every user. The output is shown to the
# player: what is wrong, never how.
set -u

app=$(ls /opt 2> /dev/null | grep -v greenbuild | head -n 1)
port=$(sed -n 's/^# Starts .* on port \([0-9]*\);.*/\1/p' "/usr/local/bin/$app-start" 2> /dev/null)
visits() {
  wget -q -T 5 -O - "http://127.0.0.1:$port/check" 2> /dev/null | sed -n 's/^.*: \([0-9]*\) visits$/\1/p'
}

if ! pgrep -u redis redis-server > /dev/null; then
  echo "the cache is not running"
  exit 1
fi
if redis-cli -p 6379 ping 2> /dev/null | grep -q PONG; then
  echo "the cache answers without a password"
  exit 1
fi
if [ -z "$port" ] || ! pgrep -u "$app" -f "/opt/$app/app.py" > /dev/null; then
  echo "the app is not running as its own user"
  exit 1
fi
first=$(visits)
second=$(visits)
if [ -z "$first" ] || [ "$second" != "$((first + 1))" ]; then
  echo "the app's pages still cannot count visits"
  exit 1
fi
# The last digit of the mode is what every other user may do.
case "$(stat -c %a "/etc/$app/app.env" 2> /dev/null)" in
  *[!0]) echo "the app's settings can be read by every user"; exit 1 ;;
esac
echo "the pages count visits again"
