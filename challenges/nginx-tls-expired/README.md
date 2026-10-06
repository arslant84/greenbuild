# HTTPS is broken

## What was broken

The site's TLS certificate, issued by the company's internal CA, had expired. nginx kept serving it, and every client refused the connection: `curl` reports `certificate has expired`, and browsers show a security error.

## How to find it

- `curl -v https://<site>/` (the name is `server_name` in `/etc/nginx/conf.d/site.conf`) fails with `SSL certificate problem: certificate has expired`.
- `openssl x509 -noout -dates -in /etc/nginx/tls/<site>.crt` shows a `notAfter` in the past.
- `openssl x509 -noout -issuer -in ...` shows the internal CA, whose key is in `/etc/ssl/internal-ca`.

## The fix

Renew from the kept request with the same CA, then reload nginx:

```sh
openssl x509 -req -in /etc/nginx/tls/<site>.csr -CA /etc/ssl/internal-ca/ca.crt \
  -CAkey /etc/ssl/internal-ca/ca.key -CAcreateserial -copy_extensions copy -days 90 \
  -out /etc/nginx/tls/<site>.crt
nginx -s reload
```

`-copy_extensions copy` keeps the subjectAltName: modern clients ignore the CN and check the SAN.

## What not to do

- A self-signed certificate, or `curl -k`, only hides the error: clients that trust the internal CA would still refuse it.
- A certificate valid for a day brings the outage back tomorrow. Monitor expiry dates and renew automatically.
