#!/bin/sh
# Reference fix used by CI: give the report's location a read timeout longer than the report takes.
set -eu

conf=/etc/nginx/http.d/finance.conf
port=$(sed -n 's#.*proxy_pass http://127.0.0.1:\([0-9]*\);#\1#p' "$conf" | head -n 1)
sed -i "s#^    location / {#    location /report/ {\n        proxy_pass http://127.0.0.1:$port;\n        proxy_read_timeout 30s;\n    }\n\n    location / {#" "$conf"
nginx -t
nginx -s reload
sleep 1
