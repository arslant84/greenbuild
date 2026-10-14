# Hints

## Hint 1

The app's log under `/var/log/` ends with the error that stopped it. Which module can it not find, and who does the app run as?

## Hint 2

`pip install --user` puts a package in the installing user's own home, on that user's path only. Who ran last night's deploy (see its log), and where did the library go? `pip show -f acme-invoice` tells you.

## Hint 3

Install the library where every user's Python finds it, from the wheels the deploy used (there is no network), then start the app with its start script. As root, pip still sees root's own copy and may say it is already installed: remove that copy first. Opening root's home or running the app as root are not fixes.
