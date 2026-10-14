#!/bin/sh
# Reference fix used by CI: rotate the app's password with a new 90-day validity, as the policy asks, and
# give the app the new password.
set -eu

# shellcheck disable=SC1091
. /etc/app/db.env
password=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')
su postgres -c "psql -q -c \"alter role $PGUSER password '$password' valid until '$(date -u -d "@$(($(date +%s) + 90 * 86400))" +%F)'\""
sed -i "s/^PGPASSWORD=.*/PGPASSWORD=$password/" /etc/app/db.env
