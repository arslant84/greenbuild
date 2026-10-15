# Hints

## Hint 1

The receiver logs every notification it refuses, and the provider logs every delivery, under `/var/log/`. Why would a signature not match when both sides were given the same secret?

## Hint 2

The secret in `/etc/<app>/app.env` looks right, but what matters is what the app ends up with. The receiver loads that file with the `dotenv` library; ask it, as the app's user, what `WEBHOOK_SECRET` becomes. Look closely at the characters in the secret.

## Hint 3

In a `.env` file, `#` in an unquoted value starts a comment. Quote the value, restart the receiver (it reads its settings at start), then have the provider deliver the payments it failed to deliver this morning: `send-payment <order>`.
