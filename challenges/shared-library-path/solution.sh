#!/bin/sh
# Reference fix used by CI: tell musl's loader about the vendor's library directory. Its path file
# replaces the default search path, so it lists the system directories too.
set -eu

loader=$(ls /lib/ld-musl-*.so.1)
path_file="/etc/$(basename "$loader" .so.1).path"
printf '/lib\n/usr/local/lib\n/usr/lib\n/opt/vendor/pricer-4.2/lib\n' > "$path_file"
