# Hints

## Hint 1

PHP logs the fatal error the export hits. Find that log and read the number in the error: is it the limit ops set?

## Hint 2

`php.ini` is not the last word for php-fpm. Each pool's configuration can set PHP values too. Search everything under `/etc/php83/` for the setting.

## Hint 3

A pool's `php_admin_value` overrides `php.ini`, and scripts cannot change it. Change the value where it actually applies, then restart php-fpm so the pool reads it.
