# Hints

## Hint 1

The job logs what ssh answered under `/var/log/`. Run it yourself as the user it runs as, and add `-v` to the ssh call to see each step. What did the server restore change?

## Hint 2

The OpenSSH client is strict about its own files: it will not read a config that other users can write, and it will not use a private key that other users can read. Look at the modes in the job user's `~/.ssh`.

## Hint 3

Give the files back private modes: the directory `700`, the config, the private key and `known_hosts` `600`. Fix one, run the job again, and read the next message.
