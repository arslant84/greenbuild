#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

new=$((40 + seed % 50))
old=$((new - 1))
legacy=$(echo "old-docs wiki help-center" | cut -d' ' -f $((seed / 50 % 3 + 1)))
mkdir -p /etc/nginx/snippets "/srv/releases/$old" "/srv/releases/$new"
for release in "$old" "$new"; do
  printf 'release %s %s\n' "$release" "$(printf 'greenbuild-reload-%s-%s' "$seed" "$release" | sha256sum | cut -c1-12)" > "/srv/releases/$release/index.html"
done

site() {
  cat > /etc/nginx/conf.d/site.conf <<CONF
server {
    listen 80 default_server;
    root /srv/releases/$1;
    include /etc/nginx/snippets/*.conf;
}
CONF
}

# Yesterday: the old release, and the legacy redirects as the docs team left them.
site "$old"
cat > /etc/nginx/snippets/legacy-redirects.conf <<CONF
# Old links from before the docs moved (docs team).
location /$legacy/ {
    return 301 /docs/;
}
CONF
nginx

# Later yesterday the docs team added a redirect and did not test it; nothing reloaded nginx since.
cat > /etc/nginx/snippets/legacy-redirects.conf <<CONF
# Old links from before the docs moved (docs team).
location /$legacy/ {
    return 301 /docs/;
}
location = /faq {
    return 301 /docs/faq
}
CONF

# This morning's deploy: switch the site to the new release and reload, without checking the result.
site "$new"
{
  echo "$(date -u +%FT%TZ) deploy release $new: site root /srv/releases/$new"
  echo "$(date -u +%FT%TZ) nginx -s reload"
  nginx -s reload 2>&1 || true
  echo "$(date -u +%FT%TZ) deploy finished"
} >> /var/log/deploy.log
rm -f "$0"
