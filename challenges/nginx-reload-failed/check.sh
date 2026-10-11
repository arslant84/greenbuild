#!/bin/sh
# Exit 0 when nginx runs a configuration that passes its test, serves the newest release, and still
# redirects the legacy links. The output is shown to the player: what is wrong, never how.
set -u

newest=$(ls /srv/releases | sort -n | tail -n 1)
expected=$(cat "/srv/releases/$newest/index.html" 2> /dev/null) || { echo "the new release is missing"; exit 1; }
legacy=$(sed -n 's#^location /\([a-z-]*\)/ {$#\1#p' /etc/nginx/snippets/legacy-redirects.conf 2> /dev/null | head -n 1)

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
if ! nginx -t > /dev/null 2>&1; then
  echo "nginx's configuration does not pass its own test"
  exit 1
fi
if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$expected" ]; then
  echo "the site does not serve the new release"
  exit 1
fi
# redirect prints where a path redirects to, without following it.
redirect() {
  curl -s -o /dev/null --max-time 5 -w '%{redirect_url}' "http://127.0.0.1$1"
}

if [ -z "$legacy" ] || [ "$(redirect "/$legacy/page")" != "http://127.0.0.1/docs/" ]; then
  echo "the legacy links no longer redirect to the docs"
  exit 1
fi
if [ "$(redirect /faq)" != "http://127.0.0.1/docs/faq" ]; then
  echo "the docs team's newest redirect does not work"
  exit 1
fi
echo "the new release is live"
