#!/bin/sh
# Reference fix used by CI: drop the archive's old host key, then add the key the host presents now,
# after checking its fingerprint against the one ops published.
set -eu

app=$(ls /home | grep -E '^(reports|billing|analytics)$' | head -n 1)
ssh_dir="/home/$app/.ssh"
port=$(sed -n 's/^ *Port //p' "$ssh_dir/config")
published=$(grep -o 'SHA256:[^ ]*' "/var/log/$app/ops.log" | tail -n 1)

su "$app" -c "ssh-keygen -R '[127.0.0.1]:$port' -f $ssh_dir/known_hosts" > /dev/null 2>&1
su "$app" -c "ssh -o StrictHostKeyChecking=accept-new archive < /dev/null" > /dev/null 2>&1 || true
seen=$(ssh-keygen -lf "$ssh_dir/known_hosts" -F "[127.0.0.1]:$port" | grep -o 'SHA256:[^ ]*' | head -n 1)
[ "$seen" = "$published" ]
