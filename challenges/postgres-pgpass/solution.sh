#!/bin/sh
# Reference fix used by CI: make the password file private, which libpq requires, and give its entry the
# host the job connects to; libpq matches the host name literally.
set -eu

chmod 0600 /home/backup/.pgpass
sed -i 's/^localhost:/127.0.0.1:/' /home/backup/.pgpass
