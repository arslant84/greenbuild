# Hints

## Hint 1

nginx's error log in `/var/log/nginx/` says why it cannot reach the app. Error 13 is "permission denied".

## Hint 2

nginx talks to PHP-FPM through a unix socket. A socket is a file: `ls -l` shows who may connect to it, and `ps -o user,args` shows which user nginx's workers run as. The pool's file in `/etc/php84/php-fpm.d/` sets the socket's owner, group and mode.

## Hint 3

Keep the socket closed to other users (mode 0660), but let nginx's group connect: set `listen.group` to that group, or add nginx's user to the socket's group. Then reload PHP-FPM (`kill -USR2` on the pid in `/run/php-fpm/php-fpm.pid`), or nginx for a group change.
