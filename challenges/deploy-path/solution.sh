#!/bin/sh
# Reference fix used by CI: put the vetted tools in front of the system PATH instead of replacing it,
# then ship the release with the script.
set -eu

sed -i 's|^PATH=/opt/deploy/bin$|PATH=/opt/deploy/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin|' /usr/local/bin/deploy
deploy /var/deploy/incoming/*.tar.gz
