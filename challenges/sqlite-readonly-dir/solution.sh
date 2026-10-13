#!/bin/sh
# Reference fix used by CI: give the database directory back to the app's user, as before the restore.
set -eu

app=$(ls /opt | grep -v greenbuild | head -n 1)
chown "$app" "/var/lib/$app"
