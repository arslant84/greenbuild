#!/bin/sh
# Reference fix used by CI: rebuild the virtualenv where it lives, from the release's wheels, and start.
set -eu

app=$(ls /srv | head -n 1)
python3 -m venv --clear "/srv/$app/venv"
"/srv/$app/venv/bin/python" -m pip install --quiet --no-index --find-links /opt/wheels acme-reports
"/usr/local/bin/$app-start"
# Python starts slowly under gVisor; wait until the service answers, up to 10 s.
port=$(sed -n 's/^# Starts .* on port \([0-9]*\)\..*/\1/p' "/usr/local/bin/$app-start")
for _ in $(seq 50); do
  wget -q -T 1 -O /dev/null "http://127.0.0.1:$port/ready" 2> /dev/null && break
  sleep 0.2
done
