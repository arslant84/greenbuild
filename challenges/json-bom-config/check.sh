#!/bin/sh
# Exit 0 when the app runs as its own user from a config file that starts with plain JSON, serves its
# page, and applies the new 50 MB upload limit. The output is shown to the player: what is wrong,
# never how.
set -u

config=$(ls /etc/*/config.json 2> /dev/null | head -n 1)
app=$(basename "$(dirname "$config")")
port=$(sed -n 's/^ *"port": \([0-9]*\),$/\1/p' "$config" 2> /dev/null)
greeting=$(sed -n 's/^ *"greeting": "\([^"]*\)",$/\1/p' "$config" 2> /dev/null)

if [ "$(head -c 3 "$config" | od -An -tx1 | tr -d ' ')" = "efbbbf" ]; then
  echo "the app's config file would still stop the app on its next start"
  exit 1
fi
if ! pgrep -u "$app" -f "/opt/$app/app.py" > /dev/null; then
  echo "the app is not running as its own user"
  exit 1
fi
if [ -z "$port" ] || [ "$(wget -q -T 5 -O - "http://127.0.0.1:$port/" 2> /dev/null)" != "$greeting" ]; then
  echo "the app does not serve its page"
  exit 1
fi
if [ "$(wget -q -T 5 -O - "http://127.0.0.1:$port/limits" 2> /dev/null)" != '{"max_upload_mb": 50}' ]; then
  echo "the app does not apply the new upload limit"
  exit 1
fi
echo "the app is back with the new limit"
