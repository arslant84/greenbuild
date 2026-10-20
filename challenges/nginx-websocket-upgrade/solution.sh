#!/bin/sh
# Reference fix used by CI: proxy the live feed over HTTP/1.1 and pass the client's upgrade to it, then
# reload nginx.
set -eu

conf=$(ls /etc/nginx/http.d/*.conf)
awk '{ print }
/proxy_pass http:\/\/127\.0\.0\.1/ {
  print "        proxy_http_version 1.1;"
  print "        proxy_set_header Upgrade $http_upgrade;"
  print "        proxy_set_header Connection \"upgrade\";"
}' "$conf" > "$conf.new"
mv "$conf.new" "$conf"
nginx -t
nginx -s reload
sleep 1
