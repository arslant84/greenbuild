#!/bin/sh
# Reference fix used by CI: find the renewal key whose public key matches the installed certificate,
# put it where nginx expects the key, and start nginx.
set -eu

conf=/etc/nginx/conf.d/site.conf
cert=$(sed -n 's/^ *ssl_certificate \([^;]*\);/\1/p' "$conf")
key=$(sed -n 's/^ *ssl_certificate_key \([^;]*\);/\1/p' "$conf")
want=$(openssl x509 -in "$cert" -noout -pubkey)
for candidate in /etc/nginx/tls/keys/*.key; do
  if [ "$(openssl pkey -in "$candidate" -pubout 2>/dev/null)" = "$want" ]; then
    cp "$candidate" "$key"
  fi
done
nginx
sleep 1
