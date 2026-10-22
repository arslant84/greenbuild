# Hints

## Hint 1

The deploy job logs what git told it. Read the last run in `/var/log/<app>/deploy.log`, and look at the checkout's state as the deploy user.

## Hint 2

Someone changed a file in the checkout by hand last night; `/var/log/ops.log` says what and why. Before deciding what to do with that change, compare it with what the release does to the same file.

## Hint 3

If the release already carries the same change, the local edit is safe to throw away. Restore the file to its committed state, then run the deploy job again, all as the deploy user.
