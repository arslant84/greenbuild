#!/bin/sh
# Exit 0 when nginx still reaches the backend by its name, the name resolves to this host, and the
# site serves the backend's page. The output is shown to the player: what is wrong, never how.
set -u

conf=/etc/nginx/conf.d/site.conf
host=$(sed -n 's#^ *proxy_pass http://\([a-z]*\.internal\):[0-9]*;$#\1#p' "$conf" 2> /dev/null)
if [ -z "$host" ]; then
  echo "nginx no longer reaches the backend by its name; its configuration is managed elsewhere"
  exit 1
fi
service=${host%.internal}
expected=$(cat "/srv/$service/index.html" 2> /dev/null) || { echo "the backend's page is missing"; exit 1; }

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi

case "$(getent hosts "$host" | awk '{ print $1 }')" in
  127.*) ;;
  *)
    echo "$host does not resolve to this host"
    exit 1
    ;;
esac

if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the backend's page"
  exit 1
fi

echo "the site is back"
