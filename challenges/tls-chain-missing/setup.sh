#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

site=$(echo "intranet wiki portal" | cut -d' ' -f $((seed % 3 + 1)))
host="$site.acme.test"
page_token=$(printf 'greenbuild-chain-%s' "$seed" | sha256sum | cut -c1-16)
ca=/etc/ssl/acme-ca
tls="/etc/nginx/tls/$site"
work=$(mktemp -d)

# The company's internal CA: a root every employee's machine trusts, and the intermediate that signs
# the servers' certificates. Only the root is installed on clients.
mkdir -p "$ca" "$tls"
openssl ecparam -genkey -name prime256v1 -out "$work/root.key" 2> /dev/null
openssl req -x509 -new -key "$work/root.key" -subj "/O=ACME/CN=ACME Root CA" -days 3650 -out "$ca/root.pem" 2> /dev/null
openssl ecparam -genkey -name prime256v1 -out "$work/issuing.key" 2> /dev/null
openssl req -new -key "$work/issuing.key" -subj "/O=ACME/CN=ACME Issuing CA 2" -out "$work/issuing.csr" 2> /dev/null
printf 'basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\n' > "$work/issuing.ext"
openssl x509 -req -in "$work/issuing.csr" -CA "$ca/root.pem" -CAkey "$work/root.key" -CAcreateserial -days 1825 -extfile "$work/issuing.ext" -out "$work/issuing.pem" 2> /dev/null

# Yesterday's renewal: the CA's email had the certificate and the chain; only the certificate went in.
openssl ecparam -genkey -name prime256v1 -out "$tls/privkey.pem" 2> /dev/null
openssl req -new -key "$tls/privkey.pem" -subj "/O=ACME/CN=$host" -out "$work/site.csr" 2> /dev/null
printf 'subjectAltName=DNS:%s\nextendedKeyUsage=serverAuth\n' "$host" > "$work/site.ext"
openssl x509 -req -in "$work/site.csr" -CA "$work/issuing.pem" -CAkey "$work/issuing.key" -CAcreateserial -days 397 -extfile "$work/site.ext" -out "$tls/cert.pem" 2> /dev/null
mkdir -p /root/renewal-2026-10
cp "$tls/cert.pem" "/root/renewal-2026-10/$site.crt"
cp "$work/issuing.pem" /root/renewal-2026-10/chain.pem
printf 'From: pki@acme.test\nSubject: Certificate for %s renewed\n\nAttached: %s.crt (your certificate) and chain.pem (ACME Issuing CA 2).\n' "$host" "$site" > /root/renewal-2026-10/email.txt
chmod 0600 "$tls/privkey.pem"
rm -rf "$work"

mkdir -p "/srv/$site"
printf '%s\n' "$page_token" > "/srv/$site/index.html"
cat > "/etc/nginx/conf.d/$site.conf" <<CONF
server {
    listen 443 ssl default_server;
    server_name $host;
    ssl_certificate     $tls/cert.pem;
    ssl_certificate_key $tls/privkey.pem;
    root /srv/$site;
}
CONF
nginx
sleep 1
rm -f "$0"
