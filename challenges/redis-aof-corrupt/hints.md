# Hints

## Hint 1

Redis says why it refuses to start in the log file its configuration names. Which file does it fail to read, and what does it suggest?

## Hint 2

Redis ships a tool that checks its append-only files and can cut them back to the last command written in full. Since Redis 7 the AOF is several files listed in a manifest; the tool takes the manifest. Keep a copy of the directory first.

## Hint 3

Once the AOF is valid, start Redis with its configuration as the redis user, the way it always runs, and see which sessions came back.
