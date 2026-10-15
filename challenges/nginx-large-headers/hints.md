# Hints

## Hint 1

Sign in yourself: `curl -i http://127.0.0.1/cgi-bin/login`. Then ask the app directly, on the port nginx proxies to. Do the two answers differ? What does nginx's error log say?

## Hint 2

The app's answer starts with a very long `Set-Cookie` header: the new provider's session. nginx reads an upstream's response headers into a buffer of its own, separate from the one for the body, and that buffer is small by default.

## Hint 3

`proxy_buffer_size` sizes the buffer for the upstream's response headers. Raise it in the site's `location`, then `nginx -t`: it checks that the related `proxy_buffers` and `proxy_busy_buffers_size` still fit together. Reload when it passes.
