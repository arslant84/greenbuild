# Hints

## Hint 1

The feed service is running, so ask it what it sees. Its log under `/var/log/` records every handshake it refuses, and nginx's access log shows what the browser got back.

## Hint 2

A websocket starts as an HTTP/1.1 request that asks to upgrade the connection. Compare what the browser sends with what nginx forwards to the feed: the protocol version and the headers.

## Hint 3

nginx forwards over HTTP/1.0 unless told otherwise, and it drops hop-by-hop headers such as `Upgrade` and `Connection`. The `/live` location needs both changed; reload nginx after editing.
