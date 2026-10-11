# Hints

## Hint 1

`/var/log/deploy.log` and the app's start log say what happened when the deploy hook ran the script. "not found" does not always mean the script itself is missing: what else does the kernel have to find to run it?

## Hint 2

Look at the script's bytes, not just its text: `cat -A` or `od -c` show characters an editor hides. Where was this release packed?

## Hint 3

Every line of the script, its first line too, ends with an extra character the shell treats as part of the line. Remove it, keep the script executable, and start the app the way the deploy hook does: as its own user.
