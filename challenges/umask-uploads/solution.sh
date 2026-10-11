#!/bin/sh
# Reference fix used by CI: give the service a umask that leaves files readable (but not writable) by
# others, restart it, and make the files it already stored readable.
set -eu

env_file=$(ls /etc/*/*.env | head -n 1)
service=$(basename "$(dirname "$env_file")")
sed -i 's/^UMASK=.*/UMASK=0022/' "$env_file"
pkill -u "$service" -f "/usr/local/bin/$service"
su -s /bin/sh "$service" -c "nohup $service > /dev/null 2>&1 &"
chmod 0644 /srv/uploads/*
sleep 1
