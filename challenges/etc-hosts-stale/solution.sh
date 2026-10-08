#!/bin/sh
# Reference fix used by CI: point the service's name at this host, then make nginx resolve it again.
# The container's /etc/hosts is a mount, so it is rewritten in place rather than replaced (sed -i).
set -eu

host=$(sed -n 's#^ *proxy_pass http://\([a-z]*\.internal\):[0-9]*;$#\1#p' /etc/nginx/conf.d/site.conf)
fixed=$(awk -v host="$host" '$2 == host { $1 = "127.0.0.1" } { print }' /etc/hosts)
printf '%s\n' "$fixed" > /etc/hosts
nginx -s reload
sleep 1
