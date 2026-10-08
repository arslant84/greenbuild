#!/bin/sh
# Reference fix used by CI: let the store's own location take artifacts up to 25 MB, leaving the
# hardening baseline as it is for every other site, then reload nginx.
set -eu

sed -i 's|^        client_body_temp_path \(.*\);$|        client_body_temp_path \1;\n        client_max_body_size 25m;|' /etc/nginx/conf.d/store.conf
nginx -t
nginx -s reload
sleep 1
