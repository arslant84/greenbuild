# Hints

## Hint 1

Ask nginx for the page the way a customer's browser does: the address it sends is the `Host` header, and nginx picks a site by it. Which site answers the app's address, and which answers a made-up one?

## Hint 2

nginx gives a request to the server whose `server_name` matches its `Host`; when none matches, the `default_server` takes it. Until yesterday the app's site was the only one, so it answered everything. Read the app's `server_name` letter by letter next to the address in the app's settings under `/etc`.

## Hint 3

Make the app's `server_name` the address its customers use, check the configuration and reload. Leave the launch page as the default: marketing wants unknown addresses to land there.
