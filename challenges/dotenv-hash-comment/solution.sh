#!/bin/sh
# Reference fix used by CI: quote the secret so dotenv keeps what follows the '#', restart the receiver,
# and have the provider deliver this morning's refused payments again.
set -eu

app=$(ls /etc | grep -E '^(store|bookings|tickets)$' | head -n 1)
sed -i 's/^WEBHOOK_SECRET=\(.*\)$/WEBHOOK_SECRET="\1"/' "/etc/$app/app.env"
pkill -u "$app" -x node
sleep 1
"$app-webhooks-start"
sleep 1
for order in $(grep -o 'ORD-[0-9]* delivered: HTTP 401' /var/log/payments-provider/deliveries.log | cut -d' ' -f1); do
  send-payment "$order"
done
