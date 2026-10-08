#!/bin/sh
# Reference fix used by CI: let the cache evict its least recently used entries, in the running
# server and in its configuration file.
set -eu

conf=/etc/redis/cache.conf
port=$(awk '$1 == "port" { print $2 }' "$conf")
sed -i 's/^maxmemory-policy .*/maxmemory-policy allkeys-lru/' "$conf"
redis-cli -p "$port" config set maxmemory-policy allkeys-lru
