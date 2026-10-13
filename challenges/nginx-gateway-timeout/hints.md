# Hints

## Hint 1

Ask for the report through the site and watch what comes back, and how long it takes. Then look at nginx's error log: what did it give up on, and after how long?

## Hint 2

nginx waits for the app's answer only as long as `proxy_read_timeout` allows. The report needs longer than the site's setting; the app itself answers fine if you ask it directly on its own port.

## Hint 3

Give the report's location in the site's configuration a read timeout longer than the report takes, check the configuration and reload. The rest of the site can keep failing fast.
