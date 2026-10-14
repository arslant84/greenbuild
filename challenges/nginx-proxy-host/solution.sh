#!/bin/sh
# Reference fix used by CI: pass the address the visitor used on to the shop, then reload nginx.
set -eu

conf=$(ls /etc/nginx/http.d/*.conf | head -n 1)
sed -i 's#^\( *\)proxy_pass \(.*\);#\1proxy_pass \2;\n\1proxy_set_header Host $host;#' "$conf"
nginx -t
nginx -s reload
sleep 1
