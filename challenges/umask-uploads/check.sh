#!/bin/sh
# Exit 0 when the site serves every stored upload, none is writable by others, and a new upload the
# check drops into the spool comes out readable too. The output is shown to the player: what is
# wrong, never how.
set -u

env_file=$(ls /etc/*/*.env 2> /dev/null | head -n 1)
service=$(basename "$(dirname "$env_file")")
spool=/var/spool/$service/incoming

served() {
  [ "$(wget -q -T 5 -O - "http://127.0.0.1/files/$1" 2> /dev/null)" = "$(cat "/srv/uploads/$1")" ]
}

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
if ! pgrep -u "$service" -f "/usr/local/bin/$service" > /dev/null; then
  echo "the $service service is not running as its own user"
  exit 1
fi
if [ -n "$(find /srv/uploads -type f -perm -o+w)" ]; then
  echo "some uploads can be changed by any user on the host"
  exit 1
fi
for file in /srv/uploads/*; do
  if ! served "$(basename "$file")"; then
    echo "the site does not serve every stored upload"
    exit 1
  fi
done

# A new upload arrives; the service has a few seconds to store it.
probe="check-$(date +%s).txt"
printf 'probe %s\n' "$probe" > "$spool/$probe"
chown "$service" "$spool/$probe"
for _ in 1 2 3 4 5 6; do
  [ -f "/srv/uploads/$probe" ] && break
  sleep 1
done
if [ ! -f "/srv/uploads/$probe" ]; then
  echo "new uploads are not stored any more"
  exit 1
fi
result=0
served "$probe" || { echo "a new upload is not served"; result=1; }
rm -f "/srv/uploads/$probe"
[ "$result" -eq 0 ] && echo "uploads are back"
exit "$result"
