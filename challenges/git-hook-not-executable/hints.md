# Hints

## Hint 1

Push a small commit yourself, as the git user, and read everything git prints, not only whether the push succeeded. The developers' last push is in `/var/log/`.

## Hint 2

git runs a hook only when it is executable. When it does run it, the kernel starts the program named on the hook's first line.

## Hint 3

Make the hook executable for its owner only, then push again. If git now says it cannot exec the hook although the file is there, check that the interpreter on its first line exists on this host.
