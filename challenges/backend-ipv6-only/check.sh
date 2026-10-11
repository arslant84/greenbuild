#!/bin/sh
# Exit 0 when nginx still reaches the app at the address config management set, the app listens there
# as its own user and keeps doing so on its next start, and the site serves the app's page. The output
# is shown to the player: what is wrong, never how.
set -u

conf=/etc/nginx/conf.d/site.conf
port=$(sed -n 's#^ *proxy_pass http://127\.0\.0\.1:\([0-9]*\);$#\1#p' "$conf" 2> /dev/null)
if [ -z "$port" ]; then
  echo "nginx no longer proxies to the address config management set"
  exit 1
fi
env_file=$(grep -l "^PORT=$port$" /etc/*/app.env 2> /dev/null | head -n 1)
app=$(basename "$(dirname "$env_file")")
expected=$(cat "/srv/$app/index.html" 2> /dev/null) || { echo "the app's page is missing"; exit 1; }

if ! netstat -ltnp 2> /dev/null | grep -q "127\.0\.0\.1:$port .*LISTEN"; then
  echo "nothing listens where nginx sends the requests"
  exit 1
fi
if ! pgrep -u "$app" httpd > /dev/null; then
  echo "the app is not running as its own user"
  exit 1
fi
case "$(sed -n 's/^LISTEN_ADDR=//p' "$env_file")" in
  127.*) ;;
  *)
    echo "the app's settings would put it back where nginx cannot reach it on its next start"
    exit 1
    ;;
esac
if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the app's page"
  exit 1
fi
echo "the site is back"
