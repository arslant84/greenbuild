#!/bin/sh
# Exit 0 when the app runs as its own user and saves entries again, with its data neither world-writable
# nor run as root. The output is shown to the player: what is wrong, never how.
set -u

app=$(ls /opt 2> /dev/null | grep -v greenbuild | head -n 1)
data="/var/lib/$app"
port=$(sed -n 's/^HTTPServer(("127.0.0.1", \([0-9]*\)), Handler).*/\1/p' "/opt/$app/app.py" 2> /dev/null)

count() {
  wget -q -T 5 -O - "http://127.0.0.1:$port/" 2> /dev/null | sed -n 's/^.*: \([0-9]*\) entries$/\1/p'
}

if [ -z "$port" ] || ! pgrep -u "$app" -f "/opt/$app/app.py" > /dev/null; then
  echo "the app is not running as its own user"
  exit 1
fi
if pgrep -u root -f "/opt/$app/app.py" > /dev/null; then
  echo "the app runs as root"
  exit 1
fi
# The last digit of a mode is what every other user may do.
for path in "$data" "$data/$app.db"; do
  case "$(stat -c %a "$path" 2> /dev/null)" in
    *[2367]) echo "the app's data can be changed by every user"; exit 1 ;;
  esac
done
before=$(count)
if [ -z "$before" ]; then
  echo "the app does not answer"
  exit 1
fi
wget -q -T 5 -O /dev/null --post-data= "http://127.0.0.1:$port/" 2> /dev/null
if [ "$(count)" != "$((before + 1))" ]; then
  echo "the app still cannot save"
  exit 1
fi
echo "the app saves again"
