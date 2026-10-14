# Hints

## Hint 1

The deploy job logs each run under `/var/log/deploy/`. What does it say since the server was rebuilt?

## Hint 2

Root's crontab (`/etc/crontabs/root`) runs the deploy job, so git runs as root in a checkout that belongs to another user. Since 2022, git refuses to work in a repository owned by someone else unless it is told to trust that repository.

## Hint 3

Either trust exactly this checkout for root (`git config --global --add safe.directory <path>`) or make the job run git as the user who owns the checkout. Trusting every repository (`*`) or giving the checkout to root are not fixes. Run the deploy job once to see the release go live.
