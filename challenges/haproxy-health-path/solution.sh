#!/bin/sh
# Reference fix used by CI: check the health endpoint the app's release 2.0 serves, then reload haproxy.
set -eu

sed -i 's#^    option httpchk GET /health$#    option httpchk GET /healthz#' /etc/haproxy/haproxy.cfg
haproxy-reload
sleep 3
