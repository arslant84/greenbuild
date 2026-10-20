# Hints

## Hint 1

Ask each copy of the app directly, on its own port, and compare with what you get through haproxy. Who is answering 503?

## Hint 2

haproxy keeps a server in rotation only while its health check passes. Its stats page on port 8404 shows each server's state and the result of its last check.

## Hint 3

Compare the path haproxy checks with the paths release 2.0 of the app serves; the app's release log says what changed. After editing the configuration, reload haproxy with its helper.
