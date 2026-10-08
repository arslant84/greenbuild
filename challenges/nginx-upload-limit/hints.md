# Hints

## Hint 1

Try an upload yourself: `curl -T <file> http://127.0.0.1/<store>/<name>`. `head -c 2000000 /dev/urandom > big.bin` makes a 2 MB file. What status comes back, and what does nginx's error log say?

## Hint 2

HTTP 413 means the request body is larger than nginx allows: `client_max_body_size`. `nginx -T` prints the whole configuration, includes too, so you can see every place it is set.

## Hint 3

The innermost setting wins: a value in the server block (here, through the included hardening snippet) beats one in `http {}`, and a value in the store's `location` beats both. Allow the store a little more than 20 MB in its own location, keep the baseline for everything else, then `nginx -t && nginx -s reload`.
