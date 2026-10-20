#!/bin/sh
# Exit 0 when the job, run as its own user, pushes a report to the archive host with the key the archive
# team registered, and that key is private to its user. The output is shown to the player: what is
# wrong, never how.
set -u

app=$(ls /home | grep -E '^(reports|billing|analytics)$' | head -n 1)
key="/home/$app/.ssh/id_archive"
incoming=/srv/archive/incoming

if [ -z "$app" ] || ! pgrep -x dropbear > /dev/null; then
  echo "the archive host is not running"
  exit 1
fi
if ! sha256sum -c /opt/greenbuild/archive-keys.sum > /dev/null 2>&1; then
  echo "the archive host no longer trusts the key its team registered"
  exit 1
fi
before=$(ls "$incoming" | wc -l)
if ! su "$app" -c /usr/local/bin/push-reports > /dev/null 2>&1 || [ "$(ls "$incoming" | wc -l)" -le "$before" ]; then
  echo "reports still do not reach the archive"
  exit 1
fi
if [ -n "$(find "$key" -perm -004 2> /dev/null)" ] || [ "$(stat -c %U "$key" 2> /dev/null)" != "$app" ]; then
  echo "the archive key can be read by other users"
  exit 1
fi
echo "reports reach the archive again"
