# Hints

## Hint 1

"Server has gone away" says the server closed the connection, not why. The server's own error log, in its data directory, says why.

## Hint 2

Ask the running server for its `max_allowed_packet`. Then find every place the configuration sets it, and note which section each one is in.

## Hint 3

Option files are read per program: each section applies only to the programs that read it. The limit that matters is the one the server enforces. Set it where the server reads it, and restart MariaDB so it survives restarts.
