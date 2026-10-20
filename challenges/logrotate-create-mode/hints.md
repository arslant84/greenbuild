# Hints

## Hint 1

The worker is alive, so look at what it writes to. Compare the current log with the one rotated last night: size, owner and mode.

## Hint 2

Check which user the worker runs as, then try to append a line to the log as that user.

## Hint 3

logrotate created the new log. Its configuration for the worker says with which owner and mode. Fix both the rule, so tonight's rotation does it right, and the file it already created.
