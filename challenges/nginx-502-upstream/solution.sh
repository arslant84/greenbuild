#!/bin/sh
# Reference fix used by CI: point nginx at the port the app actually listens on.
set -eu

. /srv/app/app.env
sed -i "s#proxy_pass http://127.0.0.1:[0-9]*;#proxy_pass http://127.0.0.1:${PORT};#" /etc/nginx/conf.d/site.conf
nginx -t
nginx -s reload
# reload returns before new workers take over
sleep 1
