#!/bin/sh
# Exit 0 when the sync job, unchanged and as its own user, fetches today's invoices over verified TLS, and
# the system's trust store holds the new internal root. The output is shown to the player: what is wrong,
# never how.
set -u

app=$(ls /etc | grep -E '^(invoices|payouts|ledger)$' | head -n 1)
today="/srv/$app/invoices-$(date -u +%F).json"
store=/etc/ssl/certs/ca-certificates.crt

if [ -z "$app" ] || ! pgrep -f 'nginx: master' > /dev/null; then
  echo "the billing API is not running"
  exit 1
fi
if ! sha256sum -c /opt/greenbuild/sync.sum > /dev/null 2>&1; then
  echo "the sync job is not the one that shipped"
  exit 1
fi
if grep -iq 'insecure' "/etc/$app/sync.env" 2> /dev/null || grep -rilqE '^\s*(-k|--insecure|insecure)\b' /home /root 2> /dev/null; then
  echo "TLS certificates are no longer checked"
  exit 1
fi
rm -f "$today"
if ! su -s /bin/sh "$app" -c "/usr/local/bin/$app-sync" > /dev/null 2>&1 || ! grep -q '"invoices"' "$today" 2> /dev/null; then
  echo "the invoice sync still fails"
  exit 1
fi
if ! openssl verify -CAfile "$store" /opt/greenbuild/new-root.pem > /dev/null 2>&1; then
  echo "the system does not trust the new internal root"
  exit 1
fi
echo "invoices sync again"
