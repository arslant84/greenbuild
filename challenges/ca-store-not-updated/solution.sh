#!/bin/sh
# Reference fix used by CI: rebuild the system trust store, so the root ops copied in is trusted.
set -eu

update-ca-certificates > /dev/null 2>&1
