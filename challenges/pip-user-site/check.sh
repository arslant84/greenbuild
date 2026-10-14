#!/bin/sh
# Exit 0 when the app runs as its own user (not root) and serves invoices rendered by the library, with
# root's home still private. The output is shown to the player: what is wrong, never how.
set -u

app=$(ls /opt 2> /dev/null | grep -v -e greenbuild -e wheels | head -n 1)
port=$(sed -n 's/^# Starts .* on port \([0-9]*\)\..*/\1/p' "/usr/local/bin/$app-start" 2> /dev/null)
order=$((1000 + $(date +%S)))
expected="ACME invoice INV-$(printf '%06d' "$order"): total $((order * 7 % 1000)).$(printf '%02d' $((order % 100))) EUR"

if [ -z "$port" ] || ! pgrep -u "$app" -f "/opt/$app/app.py" > /dev/null; then
  echo "the app is not running as its own user"
  exit 1
fi
if pgrep -u root -f "/opt/$app/app.py" > /dev/null; then
  echo "the app runs as root"
  exit 1
fi
if [ "$(wget -q -T 5 -O - "http://127.0.0.1:$port/invoice/$order" 2> /dev/null)" != "$expected" ]; then
  echo "the app does not serve invoices"
  exit 1
fi
# The last digit of the mode is what every other user may do.
case "$(stat -c %a /root)" in
  *[!0]) echo "root's home is open to other users"; exit 1 ;;
esac
echo "the app serves invoices again"
