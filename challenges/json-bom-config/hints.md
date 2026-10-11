# Hints

## Hint 1

The app's log in `/var/log/<app>/` ends with the error that stopped it. Read the last line closely: it names what the parser found, and where.

## Hint 2

The file looks valid because the problem is invisible: look at its first bytes, not its text (`head -c 8 <file> | od -c`). What did the editor that saved it this morning add?

## Hint 3

Remove the three bytes before the `{` and keep the rest of this morning's edit, then start the app with its start script.
