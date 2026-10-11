#!/bin/sh
# Reference fix used by CI: the server has no TLS, so let loopback connections authenticate without it
# (still by password), then reload PostgreSQL. The edit runs as postgres: sed -i as root would leave a
# root-owned file PostgreSQL cannot read.
set -eu

su postgres -c "sed -i 's#^hostssl\( *all *all *127\.0\.0\.1/32 *scram-sha-256\)\$#host   \1#' $PGDATA/pg_hba.conf"
su postgres -c "pg_ctl -D $PGDATA reload" > /dev/null
sleep 1
