# Hints

## Hint 1

nginx's error log in `/var/log/nginx/` names the file it cannot find. Follow its path one step at a time with `ls -l`: something on the way points nowhere.

## Hint 2

Each deploy goes into its own folder under `releases/`, and `current` is a symlink to the live one. `/var/log/deploy/deploy.log` tells which deploys built and which failed.

## Hint 3

Point `current` at the newest release whose build succeeded, not simply the newest folder. Replace the symlink in one step: `ln -sfn <release> current.new && mv -T current.new current`.
