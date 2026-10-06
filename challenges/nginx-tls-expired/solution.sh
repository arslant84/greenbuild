#!/bin/sh
# Reference fix used by CI: renew the site's certificate from its kept request with the internal CA.
set -eu

ca_dir=/etc/ssl/internal-ca
host=$(sed -n 's/^ *server_name \([^;]*\);.*/\1/p' /etc/nginx/conf.d/site.conf | head -1)
openssl x509 -req -in "/etc/nginx/tls/$host.csr" -CA "$ca_dir/ca.crt" -CAkey "$ca_dir/ca.key" -CAcreateserial \
  -copy_extensions copy -days 90 -out "/etc/nginx/tls/$host.crt" 2>/dev/null
nginx -s reload
# reload returns before new workers take over
sleep 1
