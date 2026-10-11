# Hints

## Hint 1

`nginx -t` and `/var/log/nginx/error.log` say why nginx refuses to start. `/var/log/renew-cert.log` tells what the renewal did, and what it did not.

## Hint 2

A certificate and its private key share a public key. `openssl x509 -noout -pubkey` prints the certificate's; `openssl pkey -pubout` prints a key's. Compare the installed pair, then the keys the renewal left behind.

## Hint 3

Put the key that matches the renewed certificate where the nginx configuration expects the key (or point the configuration at it), check with `nginx -t`, then start nginx.
