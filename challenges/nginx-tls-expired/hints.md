# Hints

## Hint 1

Ask a client what it dislikes: `curl -v https://<site>/` or `openssl s_client -connect 127.0.0.1:443` show the certificate nginx presents and why it is refused. The site's name is in nginx's configuration.

## Hint 2

Certificates have a validity period: `openssl x509 -noout -dates -in <file>` shows it. This one was issued by the company's internal CA, whose files live in `/etc/ssl/internal-ca`.

## Hint 3

Issue a new certificate for the same name from the same CA. The certificate request was kept next to the certificate, so the private key can stay. Install it where nginx expects it and make nginx load it.
