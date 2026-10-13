#!/bin/sh
# Reference fix used by CI: drop the three-byte BOM Notepad put at the start of the config, keeping the
# edit, and start the app as before. (busybox sed does not understand \xEF escapes, so tail cuts them.)
set -eu

config=$(ls /etc/*/config.json | head -n 1)
app=$(basename "$(dirname "$config")")
tail -c +4 "$config" > "$config.new"
cat "$config.new" > "$config"
rm -f "$config.new"
"$app-start"
# Python starts slowly under gVisor; wait until the app answers, up to 10 s.
port=$(sed -n 's/^ *"port": \([0-9]*\),$/\1/p' "$config")
for _ in $(seq 50); do
  wget -q -T 1 -O /dev/null "http://127.0.0.1:$port/limits" 2> /dev/null && break
  sleep 0.2
done
