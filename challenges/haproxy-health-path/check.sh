#!/bin/sh
# Exit 0 when the site answers through haproxy, the app's release is untouched, and haproxy's health check
# of every copy passes with 200, so a copy that goes down is still taken out of rotation. The output is
# shown to the player: what is wrong, never how.
set -u

app=$(ls /srv | grep -E '^(shop|portal|catalog)$' | head -n 1)
www="/srv/$app/www"

if [ -z "$app" ] || ! pgrep -x haproxy > /dev/null; then
  echo "haproxy is not running"
  exit 1
fi
if [ -e "$www/health" ] || [ "$(ls "$www" | wc -l)" -ne 2 ]; then
  echo "the app's release was changed"
  exit 1
fi
"/usr/local/bin/$app-start" > /dev/null 2>&1
sleep 3
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1/)" != "200" ]; then
  echo "the site still answers with an error"
  exit 1
fi

# Stats CSV: field 2 is the server, 18 its state, 37 the health check result and 38 its HTTP code.
stats=$(curl -s --max-time 3 'http://127.0.0.1:8404/stats;csv')
if [ -z "$stats" ]; then
  echo "haproxy's stats page does not answer"
  exit 1
fi
servers=$(echo "$stats" | awk -F, -v app="$app" '$1 == app && $2 != "FRONTEND" && $2 != "BACKEND"' | wc -l)
healthy=$(echo "$stats" | awk -F, -v app="$app" '$1 == app && $18 == "UP" && $37 == "L7OK" && $38 == "200"' | wc -l)
if [ "$servers" -ne 2 ] || [ "$healthy" -ne 2 ]; then
  echo "haproxy cannot tell whether each copy of the app is healthy"
  exit 1
fi
echo "the site is back, and haproxy checks both copies"
