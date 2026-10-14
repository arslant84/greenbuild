#!/bin/sh
# Reference fix used by CI: install the library for every user from the wheel directory, then start the app.
set -eu

app=$(ls /opt | grep -v -e greenbuild -e wheels | head -n 1)
# root's own copy makes pip answer "already satisfied", so remove it first.
pip uninstall --quiet --yes acme-invoice
pip install --quiet --no-index --find-links /opt/wheels acme-invoice
"$app-start"
# Python starts slowly under gVisor; wait until the app answers, up to 10 s.
port=$(sed -n 's/^# Starts .* on port \([0-9]*\)\..*/\1/p' "/usr/local/bin/$app-start")
for _ in $(seq 50); do
  wget -q -T 1 -O /dev/null "http://127.0.0.1:$port/invoice/1" 2> /dev/null && break
  sleep 0.2
done
