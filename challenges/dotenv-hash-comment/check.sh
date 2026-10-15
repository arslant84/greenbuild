#!/bin/sh
# Exit 0 when the webhook receiver, as its own user, records a payment the provider signs with its secret,
# still refuses a forged one, and this morning's refused payments are recorded. The output is shown to the
# player: what is wrong, never how.
set -u

readonly MORNING_ORDERS=3

app=$(ls /etc | grep -E '^(store|bookings|tickets)$' | head -n 1)
port=$(sed -n 's/^PORT=//p' "/etc/$app/app.env" 2> /dev/null)
paid="/var/lib/$app/paid.log"
order="CHECK-$(date +%s)"

# The users running node, leaving out zombies: a killed receiver stays one, as nothing reaps it here.
node_users() {
  for pid in $(pgrep -x node); do
    [ "$(cut -d' ' -f3 "/proc/$pid/stat" 2> /dev/null)" = "Z" ] || stat -c %U "/proc/$pid" 2> /dev/null
  done | sort -u
}

if [ -z "$app" ] || [ "$(node_users)" != "$app" ]; then
  echo "the webhook receiver is not running as its own user"
  exit 1
fi
if ! grep -qx 'whsec_[0-9a-f]*#[0-9a-f]*' /etc/payments-provider/secret 2> /dev/null; then
  echo "the payment provider's secret is not the one it issued"
  exit 1
fi
if ! /usr/local/bin/send-payment "$order" 2> /dev/null || ! grep -q "\"$order\"" "$paid" 2> /dev/null; then
  echo "payments the provider signs are still refused"
  exit 1
fi
forged=$(printf '%064d' 0)
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "X-Signature: $forged" --data-binary '{"order":"FORGED","status":"paid"}' "http://127.0.0.1:$port/webhooks/payments")
if [ "$status" != "401" ] || grep -q '"FORGED"' "$paid"; then
  echo "the webhook receiver accepts payments nobody signed"
  exit 1
fi
if [ "$(grep -c '"ORD-[0-9]*"' "$paid")" -lt "$MORNING_ORDERS" ]; then
  echo "this morning's payments are still not recorded"
  exit 1
fi
echo "payments are recorded again"
