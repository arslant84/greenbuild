# Hints

## Hint 1

The job logs what ssh said under `/var/log/`. Read the whole warning: what changed, and which file and line does it point at? Did anyone announce a change to that host?

## Hint 2

ssh remembers each host's key in the user's `~/.ssh/known_hosts`. When a host is reinstalled, its key changes, and the old entry has to go. The new key must be the one the host's owners published, or you might be trusting an impostor.

## Hint 3

`ssh-keygen -R '[host]:port'` removes one host's entry and leaves the others. Connect once with `-o StrictHostKeyChecking=accept-new`, then compare `ssh-keygen -lf ~/.ssh/known_hosts` with the fingerprint in the ops log. Do it as the job's user.
