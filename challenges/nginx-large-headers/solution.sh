#!/bin/sh
# Reference fix used by CI: give the site's proxy a header buffer the new sessions fit in, with buffers
# large enough that nginx accepts it, then reload nginx.
set -eu

conf=$(ls /etc/nginx/conf.d/*.conf)
sed -i 's|^        proxy_set_header Host \(.*\);$|        proxy_set_header Host \1;\n        proxy_buffer_size 16k;\n        proxy_buffers 8 16k;|' "$conf"
nginx -t
nginx -s reload
sleep 1
