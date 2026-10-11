#!/bin/sh
# Reference fix used by CI: add the semicolon the docs team's redirect is missing, test, then reload.
set -eu

sed -i 's#^\(    return 301 /docs/faq\)$#\1;#' /etc/nginx/snippets/legacy-redirects.conf
nginx -t
nginx -s reload
sleep 1
