# Hints

## Hint 1

The sync logs its failures under `/var/log/`, and ops logged what they did. Try the request with `curl -v` yourself: which certificate can it not find?

## Hint 2

On Linux, programs do not read every certificate in `/usr/local/share/ca-certificates/`. They read one bundle built from it. Is the new root in that bundle?

## Hint 3

The tool that rebuilds the trust store from its source folders is `update-ca-certificates`. Run it, then try the sync again. Do not turn certificate checks off.
