#!/bin/sh
# Reference fix used by CI: serve index.html for every address that is not a file, as Apache's
# FallbackResource did, then reload.
set -eu

app=$(ls /srv | head -n 1)
sed -i 's#^\(    index index.html;\)$#\1\n\n    location / {\n        try_files $uri $uri/ /index.html;\n    }#' "/etc/nginx/conf.d/$app.conf"
nginx -t
nginx -s reload
sleep 1
