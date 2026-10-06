#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

host="$(echo "shop api portal" | cut -d' ' -f $((seed % 3 + 1))).internal"
expired_days_ago=$((seed % 30 + 1))
page_token=$(printf 'greenbuild-tls-%s' "$seed" | sha256sum | cut -c1-16)
ca_dir=/etc/ssl/internal-ca
tls_dir=/etc/nginx/tls

stamp() {
  date -u -d "@$(( $(date +%s) - $1 * 86400 ))" +%Y%m%d%H%M%SZ
}

# The company's internal CA, trusted by the machine.
mkdir -p "$ca_dir" "$tls_dir" /srv/www
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$ca_dir/ca.key" -out "$ca_dir/ca.crt" \
  -subj "/CN=Internal CA" -days 3650 2>/dev/null
cp "$ca_dir/ca.crt" /usr/local/share/ca-certificates/internal-ca.crt
update-ca-certificates > /dev/null 2>&1

# The site's certificate, issued a year ago and expired a few days ago; its request is kept.
openssl req -newkey rsa:2048 -nodes -keyout "$tls_dir/$host.key" -out "$tls_dir/$host.csr" \
  -subj "/CN=$host" -addext "subjectAltName=DNS:$host" 2>/dev/null
openssl x509 -req -in "$tls_dir/$host.csr" -CA "$ca_dir/ca.crt" -CAkey "$ca_dir/ca.key" -CAcreateserial \
  -copy_extensions copy -not_before "$(stamp 365)" -not_after "$(stamp "$expired_days_ago")" \
  -out "$tls_dir/$host.crt" 2>/dev/null
chmod 0600 "$tls_dir/$host.key" "$ca_dir/ca.key"

printf '%s\n' "$page_token" > /srv/www/index.html
echo "127.0.0.1 $host" >> /etc/hosts

cat > /etc/nginx/conf.d/site.conf <<CONF
server {
    listen 80 default_server;
    server_name $host;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name $host;
    ssl_certificate $tls_dir/$host.crt;
    ssl_certificate_key $tls_dir/$host.key;
    root /srv/www;
}
CONF

nginx
rm -f "$0"
