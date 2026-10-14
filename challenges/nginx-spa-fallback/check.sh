#!/bin/sh
# Exit 0 when nginx reloads from its files and serves the app's page at every address its router knows,
# its real files as they are, and the API's own answers, errors included. The output is shown to the
# player: what is wrong, never how.
set -u

app=$(ls /srv | head -n 1)
page=$(cat "/srv/$app/index.html" 2> /dev/null)
bundle=$(ls "/srv/$app/assets" 2> /dev/null | head -n 1)
fetch() {
  wget -q -T 5 -O - --header "Host: $app.acme.test" "http://127.0.0.1$1" 2> /dev/null
}

if [ -z "$page" ] || [ -z "$bundle" ]; then
  echo "the app's files are missing"
  exit 1
fi
if ! nginx -t > /dev/null 2>&1 || ! nginx -s reload > /dev/null 2>&1; then
  echo "nginx does not reload from its configuration"
  exit 1
fi
sleep 1
if [ "$(fetch /)" != "$page" ]; then
  echo "the home page does not load"
  exit 1
fi
for path in "/orders/$(date +%s)" /settings/profile /reports/2026/q3; do
  if [ "$(fetch "$path")" != "$page" ]; then
    echo "opening an address inside the app does not load the app"
    exit 1
  fi
done
if [ "$(fetch "/assets/$bundle")" != "$(cat "/srv/$app/assets/$bundle")" ]; then
  echo "the app's script is not served as it is"
  exit 1
fi
if ! fetch /api/orders | grep -q '"orders"'; then
  echo "the API does not answer through the site"
  exit 1
fi
if fetch /api/no-such-thing > /dev/null; then
  echo "unknown API addresses no longer answer with an error"
  exit 1
fi
echo "every address in the app loads again"
