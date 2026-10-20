#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "invoices payouts ledger" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8400 + seed % 500))
host="billing-api.internal"
pki=/etc/pki-build
tls=/etc/nginx/tls
root_file=/usr/local/share/ca-certificates/example-internal-root-2026.crt

mkdir -p "$pki" "$tls" "/etc/$app" "/srv/$app" "/var/log/$app"
# The new internal root (SEC-6120), and the billing API's certificate it issued.
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout "$pki/root.key" -out "$pki/root.pem" -days 3650 -subj "/O=Example Corp/CN=Example Corp Internal Root 2026" 2> /dev/null
openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -keyout "$tls/api.key" -out "$pki/api.csr" -subj "/CN=$host" 2> /dev/null
printf 'subjectAltName=DNS:%s\n' "$host" > "$pki/san.ext"
openssl x509 -req -in "$pki/api.csr" -CA "$pki/root.pem" -CAkey "$pki/root.key" -CAcreateserial -days 365 -extfile "$pki/san.ext" -out "$tls/api.pem" 2> /dev/null
echo "127.0.0.1 $host" >> /etc/hosts

cat > /etc/nginx/conf.d/billing-api.conf <<CONF
# The internal billing API.
server {
    listen 127.0.0.1:$port ssl;
    server_name $host;
    ssl_certificate $tls/api.pem;
    ssl_certificate_key $tls/api.key;

    location /v1/invoices {
        default_type application/json;
        return 200 '{"invoices":$((3 + seed % 20)),"issuer":"billing"}';
    }
}
CONF
nginx

# Ops copied the new root to every server, and stopped there.
cp "$pki/root.pem" "$root_file"
echo "$(date -u +%FT%TZ) SEC-6120: internal CA replaced; new root copied to $root_file on all hosts" >> "/var/log/$app/ops.log"

printf 'BILLING_API=https://%s:%s\n' "$host" "$port" > "/etc/$app/sync.env"
cat > "/usr/local/bin/$app-sync" <<SCRIPT
#!/bin/sh
# $app-sync: fetches today's invoices from the billing API, as the $app user.
. /etc/$app/sync.env
if out=\$(curl -fsS "\$BILLING_API/v1/invoices" -o /srv/$app/invoices-\$(date -u +%F).json 2>&1); then
  echo "\$(date -u +%FT%TZ) synced" >> /var/log/$app/sync.log
else
  echo "\$(date -u +%FT%TZ) sync failed: \$out" >> /var/log/$app/sync.log
  exit 1
fi
SCRIPT
chmod 0755 "/usr/local/bin/$app-sync"
adduser -D -H -s /sbin/nologin "$app"
chown -R "$app:$app" "/srv/$app" "/var/log/$app"

# Only the check reads these: the job as shipped and the new root.
sha256sum "/usr/local/bin/$app-sync" > /opt/greenbuild/sync.sum
cp "$pki/root.pem" /opt/greenbuild/new-root.pem
rm -rf "$pki"

for _ in 1 2; do
  su -s /bin/sh "$app" -c "/usr/local/bin/$app-sync" > /dev/null 2>&1 || true
done
rm -f "$0"
