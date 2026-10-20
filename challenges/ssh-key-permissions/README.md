# Restored, but refused

## What was broken

The build server was restored from a backup that kept file contents but not permissions (OPS-5310): the job user's `~/.ssh` came back world-writable and its files `0666`. The OpenSSH client then refuses twice, one after the other:

1. `Bad owner or permissions on /home/<app>/.ssh/config`: it will not read a config others can write.
2. `UNPROTECTED PRIVATE KEY FILE! … bad permissions`: it ignores a private key others can read, so the archive host sees no key and answers `Permission denied (publickey)`.

## How to find it

- `/var/log/<app>/push.log`: the failures and ssh's own words.
- Run the job as its user: `su <app> -c push-reports`, or `su <app> -c 'ssh -v archive'` for the details.
- `ls -la /home/<app>/.ssh` shows the modes; `/var/log/<app>/ops.log` the restore.

## The fix

```sh
chmod 700 /home/reports/.ssh
chmod 600 /home/reports/.ssh/config /home/reports/.ssh/id_archive /home/reports/.ssh/known_hosts
```

## What not to do

- Generating a new key and adding it to the archive host: it is another team's host, and the key it trusts is fine. The check refuses a changed `authorized_keys`.
- Running the job as root, or copying the key to another user.
