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
sleep 2
