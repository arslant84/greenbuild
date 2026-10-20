#!/bin/sh
# Reference fix used by CI: the packet limit the server enforces is set under [mysqld]; the [mysql]
# setting only changes the client. Raise the server's limit and restart MariaDB.
set -eu

sed -i 's/^max_allowed_packet = 1M$/max_allowed_packet = 64M/' /etc/my.cnf.d/mariadb-server.cnf
db-restart
