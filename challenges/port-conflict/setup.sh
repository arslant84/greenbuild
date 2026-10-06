#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "orders billing catalog" | cut -d' ' -f $((seed % 3 + 1)))
app_user=$(echo "svc appsvc runner" | cut -d' ' -f $((seed / 3 % 3 + 1)))
app_port=$((5000 + seed % 1000))
page_token=$(printf 'greenbuild-port-%s' "$seed" | sha256sum | cut -c1-16)

adduser -D -H -s /sbin/nologin "$app_user"
mkdir -p "/etc/$app" "/srv/$app/www" "/var/log/$app" /srv/maintenance/www
printf '%s\n' "$page_token" > "/srv/$app/www/index.html"
printf 'APP=%s\nAPP_USER=%s\nVERSION=2.1.0\n' "$app" "$app_user" > /etc/appctl.conf
printf 'LISTEN_PORT=%s\nLOG_LEVEL=info\n' "$app_port" > "/etc/$app/$app.env"
chown -R "$app_user:$app_user" "/srv/$app" "/var/log/$app"
printf 'Down for maintenance. Back soon.\n' > /srv/maintenance/www/index.html

# Yesterday's migration kept a maintenance page on the app's port, restarted whenever it stopped.
cat > /root/maintenance.sh <<SCRIPT
#!/bin/sh
while true; do
  httpd -f -p 127.0.0.1:$app_port -h /srv/maintenance/www
  sleep 2
done
SCRIPT
nohup sh /root/maintenance.sh > /dev/null 2>&1 &

cat > /etc/nginx/conf.d/site.conf <<CONF
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:$app_port;
    }
}
CONF

sleep 1
# The app's start after maintenance fails: its port is taken.
appctl start > /dev/null 2>&1 || true
nginx
rm -f "$0"
