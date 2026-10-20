# Hints

## Hint 1

Ask for one of the page's assets yourself: `curl -I http://127.0.0.1/assets/<file>` (the page's HTML names them). Then read nginx's error log: which file did it try to open?

## Hint 2

`alias` replaces the part of the URL that the `location` matched. Compare the path in the error log with where the file really is, character by character.

## Hint 3

A location and its alias should both end with a slash, or both not. Mismatched the other way, `location /assets` with an alias ending in a slash, `/assets../` reaches the files beside the assets. Then `nginx -t && nginx -s reload`.
