#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "media assets uploads" | cut -d' ' -f $((seed % 3 + 1)))
app_user=$(echo "svc appsvc runner" | cut -d' ' -f $((seed / 3 % 3 + 1)))
app_port=$((5000 + seed % 1000))
tenants=$((40 + seed % 21))
page_token=$(printf 'greenbuild-files-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$app_user"
mkdir -p "/etc/$app" "/srv/$app/www" "/var/log/$app" "/var/lib/$app"
printf '%s\n' "$page_token" > "/srv/$app/www/index.html"
printf 'APP=%s\nAPP_USER=%s\n' "$app" "$app_user" > /etc/appctl.conf
# Fine for the handful of customers the server started with; every customer has its own log.
printf 'LIMIT_NOFILE=32\n' > "/etc/$app/$app.env"
for n in $(seq "$tenants"); do printf 'customer-%02d\n' "$n"; done > "/etc/$app/tenants"

{
  echo "pid /var/lib/$app/nginx.pid;"
  echo "daemon off;"
  echo "worker_processes 1;"
  echo "events { worker_connections 64; }"
  echo "http {"
  for path in client_body proxy fastcgi uwsgi scgi; do
    echo "    ${path}_temp_path /var/lib/$app/$path;"
  done
  echo "    server {"
  echo "        listen 127.0.0.1:$app_port;"
  echo "        root /srv/$app/www;"
  while read -r tenant; do
    echo "        access_log /var/log/$app/$tenant.log;"
  done < "/etc/$app/tenants"
  echo "    }"
  echo "}"
} > "/etc/$app/nginx.conf"
chown -R "$app_user:$app_user" "/srv/$app" "/var/log/$app" "/var/lib/$app"

cat > /etc/nginx/conf.d/site.conf <<CONF
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:$app_port;
    }
}
CONF

# The app's start after the onboarding fails: it cannot open all its logs.
appctl start > /dev/null 2>&1 || true
nginx
rm -f "$0"
