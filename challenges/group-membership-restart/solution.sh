#!/bin/sh
# Reference fix used by CI: a process keeps the groups it started with; restart the service so it runs
# with its user's new membership in media.
set -eu

script=$(ls /usr/local/bin/*-upload)
"$script" restart
sleep 1
