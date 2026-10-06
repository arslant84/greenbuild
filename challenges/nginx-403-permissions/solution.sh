#!/bin/sh
# Reference fix used by CI: let the nginx workers enter the site directory and read the page.
set -eu

root=$(sed -n 's/^ *root \([^;]*\);.*/\1/p' /etc/nginx/conf.d/site.conf | head -1)
chmod 0755 "$root"
chmod 0644 "$root/index.html"
