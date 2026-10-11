#!/bin/sh
# Reference fix used by CI: cap the reporting role's connections, then close the ones it holds; the
# worker reopens only as many as the cap allows, which leaves slots for the app.
set -eu

reporter=$(basename "$(dirname "$(ls /etc/*/worker.env | head -n 1)")")
su postgres -c "psql -q -c 'alter role $reporter connection limit 5'"
su postgres -c "psql -q -c \"select pg_terminate_backend(pid) from pg_stat_activity where usename = '$reporter'\"" > /dev/null
sleep 4
