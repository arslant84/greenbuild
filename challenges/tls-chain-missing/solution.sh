#!/bin/sh
# Reference fix used by CI: serve the certificate followed by the issuing CA's certificate, then reload.
set -eu

site=$(ls /srv | head -n 1)
tls="/etc/nginx/tls/$site"
cat "$tls/cert.pem" /root/renewal-2026-10/chain.pem > "$tls/fullchain.pem"
sed -i "s#ssl_certificate     $tls/cert.pem;#ssl_certificate     $tls/fullchain.pem;#" "/etc/nginx/conf.d/$site.conf"
nginx -t
nginx -s reload
sleep 1
