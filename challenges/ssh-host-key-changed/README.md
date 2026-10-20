# Someone could be eavesdropping

## What was broken

The archive host was reinstalled (OPS-5402) and got a new host key. The job user's `known_hosts` still holds the old one, so the OpenSSH client stops with `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!` and, in batch mode, `Host key verification failed`. That is what a man-in-the-middle would look like too; here, ops published the new key's fingerprint.

## How to find it

- `/var/log/<app>/push.log`: the warning; `/var/log/<app>/ops.log`: the reinstall and the new fingerprint.
- `su <app> -c 'ssh archive'` shows the fingerprint the host presents now; compare it with the published one.

## The fix

```sh
su reports -c "ssh-keygen -R '[127.0.0.1]:2207'"              # only the archive's old key
su reports -c "ssh -o StrictHostKeyChecking=accept-new archive" # once; check the fingerprint it prints
ssh-keygen -lf /home/reports/.ssh/known_hosts                  # matches OPS-5402's
```

## What not to do

- `StrictHostKeyChecking no` or `UserKnownHostsFile /dev/null`, in the config or in the job: the job would then talk to any host that answers on that address.
- Deleting all of `known_hosts`: the job also knows the build mirror, whose key did not change.
- Accepting the new key without comparing its fingerprint with the one ops published.
