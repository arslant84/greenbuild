# Hints

## Hint 1

The app's log under `/var/log/` records why each save failed. Reading still works, so the database file itself opens; what else does saving need?

## Hint 2

SQLite writes a journal file next to the database while it saves, so the user the app runs as must be able to create files in the database's directory, not only write the file. Compare the owner of the directory with the owner of the file, and with what the restore log says.

## Hint 3

Give the database's directory back to the app's user, as it was before the restore. Making it writable for everyone is not a fix.
