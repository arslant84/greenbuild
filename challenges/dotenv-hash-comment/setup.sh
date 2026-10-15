#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "store bookings tickets" | cut -d' ' -f $((seed % 3 + 1)))
port=$((4000 + seed % 1000))
digest=$(printf 'greenbuild-webhook-%s' "$seed" | sha256sum)
# The rotated secret, as the provider's dashboard shows it: with a '#' in the middle.
secret="whsec_$(echo "$digest" | cut -c1-14)#$(echo "$digest" | cut -c15-26)"

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/etc/$app" "/var/lib/$app" "/var/log/$app" /etc/payments-provider /var/log/payments-provider
cat > "/etc/$app/app.env" <<ENV
# Payment webhooks for the $app.
PORT=$port
PAID_LOG=/var/lib/$app/paid.log

# SEC-2093: rotated on 2026-10-14, value copied from the provider's dashboard.
WEBHOOK_SECRET=$secret
ENV
chown "root:$app" "/etc/$app/app.env"
chmod 0640 "/etc/$app/app.env"
chown "$app:$app" "/var/lib/$app" "/var/log/$app"

# The provider's side: its copy of the secret, and the tool its deliveries go through.
printf '%s\n' "$secret" > /etc/payments-provider/secret
chmod 0600 /etc/payments-provider/secret
cat > /usr/local/bin/send-payment <<'SCRIPT'
#!/bin/sh
# send-payment <order>: the payment provider delivers a signed "paid" event for the order.
set -eu
app=$(ls /etc | grep -E '^(store|bookings|tickets)$' | head -n 1)
port=$(sed -n 's/^PORT=//p' "/etc/$app/app.env")
body="{\"order\":\"$1\",\"status\":\"paid\"}"
signature=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$(cat /etc/payments-provider/secret)" | sed 's/^.* //')
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "X-Signature: $signature" --data-binary "$body" "http://127.0.0.1:$port/webhooks/payments")
echo "$(date -u +%FT%TZ) $1 delivered: HTTP $status" >> /var/log/payments-provider/deliveries.log
[ "$status" = "200" ]
SCRIPT
chmod 0755 /usr/local/bin/send-payment

cat > "/usr/local/bin/$app-webhooks-start" <<SCRIPT
#!/bin/sh
# Starts the $app webhook receiver as its user; it reads its settings at start.
su -s /bin/sh $app -c "APP_ENV_FILE=/etc/$app/app.env nohup node /opt/webhooks/server.js >> /var/log/$app/webhooks.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-webhooks-start"
"$app-webhooks-start"
sleep 1

# This morning's customers paid; every delivery was refused.
for order in "ORD-$((1000 + seed % 900))" "ORD-$((2000 + seed % 900))" "ORD-$((3000 + seed % 900))"; do
  send-payment "$order" || true
done
rm -f "$0"
