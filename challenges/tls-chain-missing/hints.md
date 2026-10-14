# Hints

## Hint 1

Connect the way an employee's machine does: it trusts only the company's root certificate under `/etc/ssl/`. What does `curl --cacert …` (or `openssl s_client -CAfile …`) say about the site, and which certificates does the server send?

## Hint 2

The site's certificate was not signed by the root itself but by an intermediate CA. Clients have only the root, so the server must send the intermediate along with its own certificate. Look at what came with yesterday's renewal under `/root/`.

## Hint 3

Serve the site's certificate followed by the intermediate's (one file, certificate first), check the configuration and reload. A new self-signed certificate is not a fix.
