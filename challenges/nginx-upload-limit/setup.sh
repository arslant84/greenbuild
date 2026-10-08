#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

store=$(echo "artifacts builds releases" | cut -d' ' -f $((seed % 3 + 1)))
root=/srv/store

mkdir -p "$root/$store" "$root/tmp" /etc/nginx/snippets
printf 'greenbuild-upload-%s\n' "$seed" > "$root/$store/README.txt"
chown -R nginx:nginx "$root"

# SEC-1450: one hardening baseline, included in every server block.
cat > /etc/nginx/snippets/hardening.conf <<CONF
# Hardening baseline (SEC-1450), included by every site.
server_tokens off;
client_max_body_size 512k;
CONF

cat > /etc/nginx/conf.d/store.conf <<CONF
# The artifact store: CI and engineers upload with PUT /$store/<name>.
server {
    listen 80 default_server;
    include /etc/nginx/snippets/hardening.conf;

    location /$store/ {
        root $root;
        dav_methods PUT DELETE;
        create_full_put_path on;
        dav_access user:rw group:r all:r;
        client_body_temp_path $root/tmp;
    }
}
CONF

nginx
rm -f "$0"
