# Hints

## Hint 1

A 403 comes from nginx itself, not from the page. nginx's error log in `/var/log/nginx` says which file it could not open, and why.

## Hint 2

nginx's workers do not run as root. Compare the user they run as (`ps`) with the owner and mode of the site's directory and page (`ls -l`).

## Hint 3

To serve a page, the workers need to enter its directory and read the file. Give them exactly that: running nginx as root, or letting everyone write the files, would only trade this outage for a security hole.
