#!/bin/sh
# Exit 0 when nginx reloads from its files and serves both the home page and the monthly report through
# the site. The output is shown to the player: what is wrong, never how.
set -u

port=$(sed -n 's/^ThreadingHTTPServer(("127.0.0.1", \([0-9]*\)), Handler).*/\1/p' /opt/finance/app.py 2> /dev/null)
home=$(sed -n 's/^            body = "\(.*\)"$/\1/p' /opt/finance/app.py 2> /dev/null | tail -n 1)
report=$(sed -n 's/^            body = "\(.*\)"$/\1/p' /opt/finance/app.py 2> /dev/null | head -n 1)

if [ -z "$port" ] || ! pgrep -u finance -f /opt/finance/app.py > /dev/null; then
  echo "the finance app is not running as its own user"
  exit 1
fi
if ! nginx -t > /dev/null 2>&1 || ! nginx -s reload > /dev/null 2>&1; then
  echo "nginx does not reload from its configuration"
  exit 1
fi
sleep 1
if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$home" ]; then
  echo "the site's home page does not load"
  exit 1
fi
if [ "$(wget -q -T 20 -O - http://127.0.0.1/report/monthly 2> /dev/null)" != "$report" ]; then
  echo "the monthly report still does not arrive through the site"
  exit 1
fi
echo "finance gets the report"
