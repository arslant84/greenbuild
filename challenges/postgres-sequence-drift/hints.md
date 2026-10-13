# Hints

## Hint 1

The app logs every failed order under `/var/log/app/`. Read the error: what does the database say about the new order's id?

## Hint 2

A `serial` id comes from a sequence, and the sequence only moves when it hands out a number. Rows inserted with their own ids, as yesterday's move did (see its log), leave it behind. Compare the sequence's current value with the highest id in the table.

## Hint 3

Set the table's sequence to the highest id in use, so the next order gets the following one. Deleting orders or dropping the key loses data.
