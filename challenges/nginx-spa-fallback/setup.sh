#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "shop crm admin" | cut -d' ' -f $((seed % 3 + 1)))
api_port=$((9000 + seed % 1000))
token=$(printf 'greenbuild-spa-%s' "$seed" | sha256sum | cut -c1-16)
bundle="app-$(printf 'greenbuild-bundle-%s' "$seed" | sha256sum | cut -c1-8).js"

# The single-page app, built by CI: one index.html, the router runs in the browser.
mkdir -p "/srv/$app/assets"
cat > "/srv/$app/index.html" <<HTML
<!doctype html>
<html><head><title>$app</title><script src="/assets/$bundle" defer></script></head>
<body><div id="root" data-build="$token"></div></body></html>
HTML
printf 'window.addEventListener("load",()=>route(location.pathname));/* %s */\n' "$token" > "/srv/$app/assets/$bundle"
# Left over from the old Apache host; nginx never reads it.
cat > "/srv/$app/.htaccess" <<HTACCESS
# Every address the app's router knows is served by index.html.
FallbackResource /index.html
HTACCESS

# The app's API, a separate service on its own port.
cat > /etc/nginx/conf.d/api.conf <<CONF
server {
    listen 127.0.0.1:$api_port;
    default_type application/json;
    location = /api/orders { return 200 '{"orders":[],"build":"$token"}\n'; }
    location / { return 404 '{"error":"not found"}\n'; }
}
CONF

# Last night's move from the old Apache host (OPS-1877).
cat > "/etc/nginx/conf.d/$app.conf" <<CONF
server {
    listen 80;
    server_name $app.acme.test;
    root /srv/$app;
    index index.html;
    access_log /var/log/nginx/$app.access.log;

    location /api/ {
        proxy_pass http://127.0.0.1:$api_port;
    }
}
CONF

nginx
sleep 1
for path in / "/assets/$bundle" /api/orders /orders /orders/1042 /settings/profile; do
  wget -q -T 5 -O /dev/null --header "Host: $app.acme.test" "http://127.0.0.1$path" 2> /dev/null || true
done
rm -f "$0"
