#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

site=$(echo "storefront dashboard docs" | cut -d' ' -f $((seed % 3 + 1)))
release="2026.10.$((10 + seed % 18))"
hash=$(printf 'greenbuild-alias-%s' "$seed" | sha256sum | cut -c1-8)
base="/srv/$site"
assets="$base/releases/$release/build/assets"

mkdir -p "$base/public" "$assets"
cat > "$base/public/index.html" <<HTML
<!doctype html>
<html><head><title>$site</title>
<link rel="stylesheet" href="/assets/app-$hash.css">
<script src="/assets/app-$hash.js" defer></script>
</head><body><div id="app">$site</div></body></html>
HTML
printf 'body{font-family:sans-serif} /* %s %s */\n' "$site" "$release" > "$assets/app-$hash.css"
printf 'console.log("%s %s");\n' "$site" "$release" > "$assets/app-$hash.js"
# The build's environment file sits next to the assets; it must never be served.
printf 'DATABASE_URL=postgres://%s:%s@db.internal/%s\n' "$site" "$hash" "$site" > "$base/releases/$release/build/.env"
ln -s "$base/releases/$release" "$base/current"

# DEP-881: assets are served from the current release's build instead of being copied to public/.
cat > "/etc/nginx/conf.d/$site.conf" <<CONF
server {
    listen 80 default_server;
    root $base/public;

    location / {
        try_files \$uri /index.html;
    }

    # DEP-881: built assets come straight from the current release.
    location /assets/ {
        alias $base/current/build/assets;
        expires 7d;
    }
}
CONF
echo "$(date -u +%FT%TZ) DEP-881: deployed $site $release; assets now served from the release build" >> /var/log/nginx/deploy.log

nginx
rm -f "$0"
