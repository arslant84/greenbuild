# Trusted yesterday

## What was broken

The company's certificates are issued by an intermediate, "ACME Issuing CA 2", signed by "ACME Root CA"; employees' machines trust only the root. Yesterday's renewal arrived as the site's certificate plus `chain.pem` (the intermediate), but only the certificate was installed, so nginx sends a leaf whose issuer clients cannot find: `unable to get local issuer certificate`.

## How to find it

- `curl --cacert /etc/ssl/acme-ca/root.pem --resolve intranet.acme.test:443:127.0.0.1 https://intranet.acme.test/` fails with `unable to get local issuer certificate`.
- `openssl s_client -connect 127.0.0.1:443 -showcerts` shows one certificate, issued by "ACME Issuing CA 2".
- `/root/renewal-2026-10/` holds the certificate, `chain.pem` and the CA's email.

## The fix

```sh
cat /etc/nginx/tls/intranet/cert.pem /root/renewal-2026-10/chain.pem > /etc/nginx/tls/intranet/fullchain.pem
# ssl_certificate /etc/nginx/tls/intranet/fullchain.pem;
nginx -t && nginx -s reload
```

## What not to do

- Replacing the certificate with a self-signed one, or turning off verification on clients.
- Putting the intermediate before the site's certificate: nginx sends the first certificate as the server's.
