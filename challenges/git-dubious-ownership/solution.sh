#!/bin/sh
# Reference fix used by CI: root trusts exactly the site's checkout, and the deploy job runs again.
set -eu

site=$(ls /srv | grep -v '^git$' | head -n 1)
HOME=/root git config --global --add safe.directory "/srv/$site"
"/usr/local/bin/deploy-$site"
