#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

host="$(echo "shop api portal" | cut -d' ' -f $((seed % 3 + 1))).internal"
matching=$((seed / 3 % 3 + 1))
page_token=$(printf 'greenbuild-tlskey-%s' "$seed" | sha256sum | cut -c1-16)
ca_dir=/etc/ssl/internal-ca
tls_dir=/etc/nginx/tls

stamp() {
  date -u -d "@$(( $(date +%s) + $1 * 86400 ))" +%Y%m%d%H%M%SZ
}

# issue signs a request for the site's key $1 with the internal CA, valid from $2 to $3 days from now.
issue() {
  openssl req -new -key "$1" -subj "/CN=$host" -addext "subjectAltName=DNS:$host" 2>/dev/null |
    openssl x509 -req -CA "$ca_dir/ca.crt" -CAkey "$ca_dir/ca.key" -CAcreateserial -copy_extensions copy \
      -not_before "$(stamp "$2")" -not_after "$(stamp "$3")" 2>/dev/null
}

mkdir -p "$ca_dir" "$tls_dir/keys" /srv/www
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$ca_dir/ca.key" -out "$ca_dir/ca.crt" -subj "/CN=Internal CA" -days 3650 2>/dev/null
cp "$ca_dir/ca.crt" /usr/local/share/ca-certificates/internal-ca.crt
update-ca-certificates > /dev/null 2>&1

# Last year's key stays in place. The renewal tool ran three times and left a new key each time; the
# certificate it installed belongs to one of them.
openssl genrsa -out "$tls_dir/$host.key" 2048 2>/dev/null
for run in 1 2 3; do
  openssl genrsa -out "$tls_dir/keys/$host-renew-$run.key" 2048 2>/dev/null
done
issue "$tls_dir/keys/$host-renew-$matching.key" -1 364 > "$tls_dir/$host.crt"
chmod 0600 "$tls_dir/$host.key" "$tls_dir"/keys/*.key
# The CA is offline: only its certificate stays on this machine.
rm -f "$ca_dir/ca.key" "$ca_dir/ca.srl"

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

cat > /var/log/renew-cert.log <<LOG
renew $host: run 1 generated keys/$host-renew-1.key, CSR submitted, CA timeout
renew $host: run 2 generated keys/$host-renew-2.key, CSR submitted, CA timeout
renew $host: run 3 generated keys/$host-renew-3.key, CSR submitted
renew $host: certificate received, installed $tls_dir/$host.crt
renew $host: reload skipped (maintenance window)
LOG

# The nightly restart after the renewal: nginx refuses the pair and stays down.
nginx 2>> /var/log/nginx/error.log || true
rm -f "$0"
