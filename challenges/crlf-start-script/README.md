# Start script not found

## What was broken

The release was packed on a Windows build share, so the app's start script has CRLF line endings. Its first line is `#!/bin/sh\r`: the kernel looks for an interpreter called `sh\r`, finds none and the shell reports the script itself as "not found". The app never started and nginx answers 502.

## How to find it

- `/var/log/deploy.log` shows the hook ran `/opt/<app>/start.sh` and failed; `/var/log/<app>/start.log` says `not found`, though `ls -l` shows the script.
- `cat -A /opt/<app>/start.sh` shows `^M$` at the end of every line; `head -c 12 … | od -c` shows `\r`.
- Running it with `sh /opt/<app>/start.sh` gets further but breaks too: `httpd` gets the document root `/srv/<app>\r`.

## The fix

```sh
sed -i 's/\r$//' /opt/<app>/start.sh                 # or dos2unix
su -s /bin/sh <app> -c /opt/<app>/start.sh           # start it as the deploy hook does
```

## What not to do

- Starting `httpd` by hand: the site comes back, but the next deploy fails the same way; the check looks at the script.
- Running the app as root: the check expects it under its own user, as the hook runs it.
