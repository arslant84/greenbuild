#!/bin/sh
# Exit 0 when nginx reloads from its files and a client that trusts only the company's root CA gets the
# site's page over verified TLS, from the renewed certificate. The output is shown to the player: what is
# wrong, never how.
set -u

site=$(ls /srv 2> /dev/null | head -n 1)
host="$site.acme.test"
page=$(cat "/srv/$site/index.html" 2> /dev/null)
renewed=$(openssl x509 -noout -fingerprint -sha256 -in "/root/renewal-2026-10/$site.crt" 2> /dev/null)

if [ -z "$page" ] || [ -z "$renewed" ]; then
  echo "the site's page or its renewed certificate is missing"
  exit 1
fi
if ! nginx -t > /dev/null 2>&1 || ! nginx -s reload > /dev/null 2>&1; then
  echo "nginx does not reload from its configuration"
  exit 1
fi
sleep 1
served=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$host" 2> /dev/null | openssl x509 -noout -fingerprint -sha256 2> /dev/null)
if [ "$served" != "$renewed" ]; then
  echo "the site does not serve its renewed certificate"
  exit 1
fi
if [ "$(curl -s -m 5 --cacert /etc/ssl/acme-ca/root.pem --resolve "$host:443:127.0.0.1" "https://$host/" 2> /dev/null)" != "$page" ]; then
  echo "employees' browsers still do not trust the site"
  exit 1
fi
echo "the site is trusted again"
