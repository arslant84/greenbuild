#!/bin/sh
# Reference fix used by CI: the release already carries last night's hotfix, so drop the in-place edit and
# let the deploy job pull.
set -eu

app=$(ls /srv | grep -E '^(billing|catalog|search)$')
su -s /bin/sh deploy -c "git -C /srv/$app checkout -- config/app.ini && /usr/local/bin/$app-deploy"
