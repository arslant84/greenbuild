#!/bin/sh
# Exit 0 when, after a database restart, the import as shipped loads the whole bundle as its user, with
# a packet limit that is not oversized. The output is shown to the player: what is wrong, never how.
set -u

readonly PACKET_MAX_BYTES=268435456

app=$(ls /srv | grep -E '^(docs|contracts|media)$' | head -n 1)
bundle="/srv/$app/bundle.bin"

if [ -z "$app" ] || ! db-restart 2> /dev/null; then
  echo "MariaDB does not start"
  exit 1
fi
if ! pgrep -u mysql -f '^/usr/bin/mariadbd ' > /dev/null; then
  echo "MariaDB does not run as its own user"
  exit 1
fi
packet=$(mariadb -N -e 'SELECT @@GLOBAL.max_allowed_packet')
if [ "$packet" -gt "$PACKET_MAX_BYTES" ]; then
  echo "MariaDB's packet limit is far larger than the import needs"
  exit 1
fi

mariadb -e "TRUNCATE TABLE $app.bundles"
su -s /bin/sh "$app" -c "/usr/local/bin/$app-import" > /dev/null 2>&1
loaded=$(mariadb -N -e "SELECT MD5(body) FROM $app.bundles" 2> /dev/null)
if [ "$loaded" != "$(md5sum "$bundle" | cut -d' ' -f1)" ]; then
  echo "the import still does not load the bundle"
  exit 1
fi
echo "the import loads the bundle, and keeps working after a restart"
