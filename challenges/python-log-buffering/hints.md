# Hints

## Hint 1

Watch the log with `tail -f` for a minute while the worker runs. When do its lines actually arrive? The top of the log shows how it looked before the move.

## Hint 2

What changed in the move is where the worker's output goes. Compare a terminal with a file: look at what the worker's stdout points to under `/proc/<pid>/fd/`.

## Hint 3

Python flushes stdout after every line only when it is a terminal; otherwise it waits for a full buffer. Make the worker's output unbuffered where it is started, then restart it with its script.
