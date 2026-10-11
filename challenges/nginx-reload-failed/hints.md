# Hints

## Hint 1

The deploy switched the configuration on disk. Is that the configuration nginx is running? `/var/log/deploy.log` kept what the reload said.

## Hint 2

`nginx -t` tests every file the configuration includes, and names the file and line it stumbles on. The site's own file may be fine.

## Hint 3

Fix the broken line where it is, rather than removing the file: the site still needs every redirect in it. Test again, then reload.
