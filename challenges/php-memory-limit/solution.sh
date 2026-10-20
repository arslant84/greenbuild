#!/bin/sh
# Reference fix used by CI: the pool's php_admin_value overrides php.ini, so raise the limit there and
# restart php-fpm.
set -eu

sed -i 's/^php_admin_value\[memory_limit\] = 32M$/php_admin_value[memory_limit] = 256M/' /etc/php83/php-fpm.d/*.conf
php-fpm83 -t
pkill -f "php-fpm: master"
sleep 1
php-fpm83
sleep 1
