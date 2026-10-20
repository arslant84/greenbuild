#!/bin/sh
# Exit 0 when the live feed's websocket opens through nginx and answers, served by the app's own feed
# running as its user. The output is shown to the player: what is wrong, never how.
set -u

app=$(ls /opt | grep -E '^(chat|tracker|auction)$' | head -n 1)

if [ -z "$app" ] || ! pgrep -f "nginx: master process" > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
"/usr/local/bin/$app-live"
sleep 1
if ! pgrep -u "$app" -f "python3 /opt/$app/live.py" > /dev/null; then
  echo "the live feed is not running as its own user"
  exit 1
fi
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1/)" != "200" ]; then
  echo "the page does not load"
  exit 1
fi

nonce=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
reply=$(python3 - "$nonce" <<'PY' 2> /dev/null
import sys

from websockets.sync.client import connect

with connect("ws://127.0.0.1/live", open_timeout=3, close_timeout=1) as live:
    live.send(sys.argv[1])
    print(live.recv(timeout=3))
PY
)
if [ "$reply" != "$app: $nonce" ]; then
  echo "the live feed does not connect through the site"
  exit 1
fi
echo "the live feed connects through the site"
