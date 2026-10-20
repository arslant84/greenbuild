# Raised the limit, still out of memory

## What was broken

The monthly export builds every row in memory and needs about 50–65 MB. When it hit the limit, ops raised `memory_limit` to 256M in `php.ini` and restarted php-fpm (OPS-2210), but the app's pool sets `php_admin_value[memory_limit] = 32M` as part of a hardening baseline (SEC-104). A pool's `php_admin_value` overrides `php.ini` and cannot be changed by the script, so the export still dies at 32M (`Allowed memory size of 33554432 bytes exhausted`) and nginx answers 500.

## How to find it

- `/var/log/<app>/php-error.log`: the fatal error names 33554432 bytes, which is 32M, not 256M.
- `/var/log/ops.log`: the change that was made, and where.
- `grep -rn memory_limit /etc/php83/`: `php.ini` says 256M, the pool in `php-fpm.d/` says 32M.
- `php83 -i` reads only `php.ini`, the CLI's view; the pool's value applies only to requests php-fpm serves.

## The fix

Raise the pool's limit, or drop the override so `php.ini` applies, then restart php-fpm:

```sh
sed -i 's/^php_admin_value\[memory_limit\] = 32M$/php_admin_value[memory_limit] = 256M/' /etc/php83/php-fpm.d/<app>.conf
php-fpm83 -t && pkill -f 'php-fpm: master' && php-fpm83
```

## What not to do

- `ini_set('memory_limit', …)` in the script: `php_admin_value` cannot be overridden at runtime.
- `-1` or a limit beyond what the container has: one runaway request can then take the whole host's memory. The check wants a value between 128M and 512M.
- Shrinking the export: the limit stays too low for the next one.
