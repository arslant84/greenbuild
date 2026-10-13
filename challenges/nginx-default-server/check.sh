#!/bin/sh
# Exit 0 when nginx reloads from its files and serves the app to the app's address, the launch page to
# its own address, and the launch page to any other address. The output is shown to the player: what
# is wrong, never how.
set -u

env_file=$(ls /etc/*/app.env 2> /dev/null | head -n 1)
app=$(basename "$(dirname "$env_file")")
host=$(sed -n 's#^PUBLIC_URL=http://\([^/]*\)/$#\1#p' "$env_file" 2> /dev/null)
app_page=$(cat "/srv/$app/index.html" 2> /dev/null)
launch_page=$(cat /srv/launch/index.html 2> /dev/null)

page() {
  wget -q -T 5 -O - --header "Host: $1" http://127.0.0.1/ 2> /dev/null
}

if [ -z "$host" ] || [ -z "$app_page" ] || [ -z "$launch_page" ]; then
  echo "the sites' pages or the app's settings are missing"
  exit 1
fi
if ! nginx -t > /dev/null 2>&1 || ! nginx -s reload > /dev/null 2>&1; then
  echo "nginx does not reload from its configuration"
  exit 1
fi
sleep 1
if [ "$(page "$host")" != "$app_page" ]; then
  echo "the app's address does not get the app"
  exit 1
fi
if [ "$(page launch.acme.test)" != "$launch_page" ]; then
  echo "the launch page's own address does not get the launch page"
  exit 1
fi
if [ "$(page "campaign.acme.test")" != "$launch_page" ]; then
  echo "other addresses no longer land on the launch page"
  exit 1
fi
echo "each address gets its own site again"
