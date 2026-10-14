# Hints

## Hint 1

The app's log under `/var/log/` says why each page fails. What does the cache answer the app?

## Hint 2

The cache's configuration now holds a password (`requirepass`); the app reads how to reach the cache from its settings under `/etc` once, when it starts. Compare what each side expects.

## Hint 3

Give the app the cache's password in its settings, make sure only the app's user can read that file, and restart the app with its start script. Taking the password off the cache undoes security's work.
