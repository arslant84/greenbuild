#!/bin/sh
# Exit 0 when the app starts the official way (appctl) with every customer still logged, runs as its
# own user, and the site serves its page through nginx. The output is shown to the player: what is
# wrong, never how.
set -u

# setup.sh never creates fewer customers than this.
readonly MIN_TENANTS=40

. /etc/appctl.conf 2> /dev/null || { echo "the app's configuration is missing"; exit 1; }
expected=$(cat "/srv/$APP/www/index.html" 2> /dev/null) || { echo "the app's page is missing"; exit 1; }
conf="/etc/$APP/nginx.conf"

if ! pgrep -f 'nginx: master process nginx$' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi

tenants=$(wc -l < "/etc/$APP/tenants" 2> /dev/null || echo 0)
logged=$(grep -c "^ *access_log /var/log/$APP/customer-[0-9]*\.log;" "$conf" 2> /dev/null || echo 0)
if [ "$tenants" -lt "$MIN_TENANTS" ] || [ "$logged" -lt "$tenants" ]; then
  echo "some customers are no longer served"
  exit 1
fi

appctl stop > /dev/null 2>&1
appctl start > /dev/null 2>&1
if ! appctl status > /dev/null 2>&1; then
  echo "the app does not start"
  exit 1
fi

if ps -o user,args | grep "nginx -e stderr -c $conf" | grep -v grep | grep -q '^root '; then
  echo "the app runs as root"
  exit 1
fi

if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the app's page"
  exit 1
fi

echo "the app is back"
