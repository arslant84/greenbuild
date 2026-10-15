# Half a secret

## What was broken

The payment provider's webhook secret was rotated (SEC-2093), and the new one has a `#` in the middle. It was pasted into `/etc/<app>/app.env` unquoted: `WEBHOOK_SECRET=whsec_…#…`. The receiver loads that file with `dotenv`, which treats `#` in an unquoted value as the start of a comment, so the app signs with only the part before it. Every payment notification fails the signature check with 401.

## How to find it

- `/var/log/<app>/webhooks.log`: `rejected webhook: signature mismatch` for every delivery.
- `/var/log/payments-provider/deliveries.log`: this morning's orders, each `HTTP 401`.
- `/etc/<app>/app.env` and `/etc/payments-provider/secret` hold the same text, yet the app disagrees with the provider. As the app's user, `node -e 'require("/opt/webhooks/node_modules/dotenv").config({ path: "/etc/<app>/app.env" }); console.log(process.env.WEBHOOK_SECRET)'` prints the cut value.

## The fix

```sh
sed -i 's/^WEBHOOK_SECRET=\(.*\)$/WEBHOOK_SECRET="\1"/' /etc/bookings/app.env   # quote the value
pkill -u bookings -x node; bookings-webhooks-start                           # it reads settings at start
send-payment ORD-1007; send-payment ORD-2007; send-payment ORD-3007            # this morning's, from deliveries.log
```

## What not to do

- Turning off the signature check: anyone could mark an order paid. The check sends a forged payment.
- Changing the provider's secret to one without `#`: the provider issued it; only its dashboard can change it.
- Running the receiver as root.
