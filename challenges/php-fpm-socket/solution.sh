#!/bin/sh
# Reference fix used by CI: give nginx's group the socket instead of the app's, then reload PHP-FPM.
set -eu

pool=$(ls /etc/php84/php-fpm.d/*.conf | head -1)
sed -i 's/^listen.group = .*/listen.group = nginx/' "$pool"
kill -USR2 "$(cat /run/php-fpm/php-fpm.pid)"
