#!/bin/sh
# Reference fix used by CI: without a terminal, Python buffers stdout in blocks; run the worker unbuffered
# from its start script, then restart it.
set -eu

script=$(ls /usr/local/bin/*-worker)
sed -i 's#nohup python3 /opt/#nohup env PYTHONUNBUFFERED=1 python3 /opt/#' "$script"
"$script" restart
