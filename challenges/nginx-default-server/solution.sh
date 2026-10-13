#!/bin/sh
# Reference fix used by CI: name the app's server after the address its customers use, then reload.
set -eu

env_file=$(ls /etc/*/app.env | head -n 1)
app=$(basename "$(dirname "$env_file")")
host=$(sed -n 's#^PUBLIC_URL=http://\([^/]*\)/$#\1#p' "$env_file")
sed -i "s/^\( *server_name \).*;/\1$host;/" "/etc/nginx/conf.d/$app.conf"
nginx -t
nginx -s reload
sleep 1
