#!/bin/sh
# Exit 0 when the running upload service, as its user and with the shared directory's permissions as they
# were, stores an upload owned by the media group. The check does not restart the service. The output is
# shown to the player: what is wrong, never how.
set -u

readonly UPLOADS=/srv/media/uploads

app=$(ls /opt | grep -E '^(gallery|avatars|attachments)$' | head -n 1)
port=$(sed -n 's/.*HTTPServer(("127.0.0.1", \([0-9]*\)).*/\1/p' "/opt/$app/upload.py" 2> /dev/null)
name="check-$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n').jpg"

if [ "$(stat -c '%U:%G %a' "$UPLOADS")" != "thumbs:media 2775" ]; then
  echo "the shared uploads directory's permissions were changed"
  exit 1
fi
pid=$(pgrep -u "$app" -f "/opt/$app/upload.py" | head -n 1)
if [ -z "$app" ] || [ -z "$pid" ] || [ -z "$port" ]; then
  echo "the upload service is not running as its own user"
  exit 1
fi
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 -X PUT --data-binary "check" "http://127.0.0.1:$port/$name")
if [ "$status" != "201" ] || [ ! -f "$UPLOADS/$name" ]; then
  echo "uploads still fail"
  exit 1
fi
if [ "$(stat -c %G "$UPLOADS/$name")" != media ]; then
  echo "uploads are not shared with the media group"
  exit 1
fi
echo "uploads are stored again"
