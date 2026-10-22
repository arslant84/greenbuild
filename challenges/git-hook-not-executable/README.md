# Pushed, but not deployed

## What was broken

The repository's `post-receive` hook deploys `main` into the site after every push. When the git server moved (INFRA-342), the hooks were copied without their modes, so the hook is `0644`. git skips a hook that is not executable: the push succeeds with only a hint, and nothing is deployed.

Making it executable reveals the second half: the hook starts with `#!/bin/bash`, and this host has no bash. git then fails with `cannot exec 'hooks/post-receive': No such file or directory`, which names the hook, not the missing interpreter.

## How to find it

- `/var/log/<app>/push.log`: `hint: The 'hooks/post-receive' hook was ignored because it's not set as executable.`
- `ls -l /srv/git/<app>.git/hooks/`: the mode.
- Push something yourself as the git user, after each change, and read what git says.
- `head -1` of the hook, then `ls /bin/bash`.

## The fix

```sh
sed -i '1s|^#!/bin/bash$|#!/bin/sh|' /srv/git/<app>.git/hooks/post-receive
chmod 0755 /srv/git/<app>.git/hooks/post-receive
```

The hook uses only POSIX sh, so `/bin/sh` runs it unchanged.

## What not to do

- `chmod 777`: anyone on the host could then rewrite what runs on every push.
- Deploying by hand: the next push is still not deployed. The check pushes a commit itself.
- Running pushes or the hook as root: the site belongs to the git user.
