#!/bin/sh
# Reference fix used by CI: point current at the last release the deploy log calls good.
set -eu

base=$(ls -d /srv/*/ | head -1)
good=$(sed -n 's/^\[\(.*\)\] build ok$/\1/p' /var/log/deploy/deploy.log | tail -1)
ln -sfn "${base}releases/$good" "${base}current.new"
mv -T "${base}current.new" "${base}current"
