#!/bin/sh
# Reference fix used by CI: give the job user's ssh files back the permissions the backup lost; the ssh
# client refuses a config others can write and a private key others can read.
set -eu

app=$(ls /home | grep -E '^(reports|billing|analytics)$' | head -n 1)
dir="/home/$app/.ssh"
chmod 0700 "$dir"
chmod 0600 "$dir/config" "$dir/id_archive" "$dir/known_hosts"
chmod 0644 "$dir/id_archive.pub"
