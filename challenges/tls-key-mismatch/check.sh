#!/bin/sh
# Exit 0 when nginx serves the site over HTTPS with a certificate the internal CA issued for the site's
# name, valid for the next 30 days. The output is shown to the player: what is wrong, never how.
set -u

ca=/etc/ssl/internal-ca/ca.crt
host=$(sed -n 's/^ *server_name \([^;]*\);.*/\1/p' /etc/nginx/conf.d/site.conf 2>/dev/null | head -1)
expected=$(cat /srv/www/index.html 2>/dev/null) || { echo "the site's page is missing"; exit 1; }
thirty_days=2592000

if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
served=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$host" 2>/dev/null | openssl x509 2>/dev/null)
if [ -z "$served" ]; then
  echo "nothing answers HTTPS on port 443"
  exit 1
fi
if ! echo | openssl s_client -connect 127.0.0.1:443 -servername "$host" -CAfile "$ca" -verify_hostname "$host" -verify_return_error > /dev/null 2>&1; then
  echo "the certificate on port 443 is not one the internal CA issued for $host"
  exit 1
fi
if ! echo "$served" | openssl x509 -noout -checkend "$thirty_days" > /dev/null; then
  echo "the certificate on port 443 expires within 30 days"
  exit 1
fi
if [ "$(curl -s --max-time 5 --cacert "$ca" "https://$host/")" != "$expected" ]; then
  echo "the site does not serve its page over HTTPS"
  exit 1
fi
echo "HTTPS is back"
