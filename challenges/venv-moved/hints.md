# Hints

## Hint 1

The service's log under `/var/log/` says the program "does not exist", yet `ls` shows it. When the kernel cannot run a script, the missing file is often not the script itself. Look at its first line.

## Hint 2

A virtualenv writes its own absolute path into the first line (`#!`) of every script it installs, `pip` included. `/var/log/deploy/release.log` says where this one was built and what happened to that place.

## Hint 3

A virtualenv cannot be moved; recreate it where it lives (`python3 -m venv --clear …`) and install the service again from the release's wheels in `/opt/wheels` (use `python -m pip`, since the copied `pip` script is broken too). Bringing the old build directory back only hides the problem until it is cleaned up again.
