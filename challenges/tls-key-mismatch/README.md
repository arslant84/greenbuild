# The renewal that took the site down

## What was broken

The certificate renewal installed the new certificate next to last year's private key. The renewal tool ran three times (the CA timed out twice) and left three new keys; the certificate belongs to one of them. At the nightly restart nginx refused the pair (`SSL_CTX_use_PrivateKey(...) failed (... key values mismatch)`) and the site went down on both ports.

## How to find it

- `nginx -t` or `/var/log/nginx/error.log`: `key values mismatch` for the site's certificate and key.
- `/var/log/renew-cert.log`: three runs, three keys in `/etc/nginx/tls/keys/`, a certificate installed, no reload.
- Compare public keys: `openssl x509 -in <host>.crt -noout -pubkey` against `openssl pkey -in <key> -pubout` for each candidate (or the RSA modulus with `-modulus`).

## The fix

```sh
cp /etc/nginx/tls/keys/<host>-renew-<n>.key /etc/nginx/tls/<host>.key   # the key whose public key matches
nginx -t && nginx
```

## What not to do

- A self-signed certificate: clients that trust only the internal CA refuse it, and so does the check.
- Turning TLS off: the check needs HTTPS.
- Waiting for the CA: it is offline, and the renewed certificate is already here.
