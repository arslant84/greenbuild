#!/bin/sh
# Reference fix used by CI: end the alias with a slash, as its location does, so /assets/app.css maps to
# assets/app.css rather than assetsapp.css; then reload nginx.
set -eu

conf=$(ls /etc/nginx/conf.d/*.conf)
sed -i 's#^\(        alias .*/build/assets\);$#\1/;#' "$conf"
nginx -t
nginx -s reload
sleep 1
