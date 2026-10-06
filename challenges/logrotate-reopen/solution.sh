#!/bin/sh
# Reference fix used by CI: tell nginx to reopen its logs after each rotation, and once now.
set -eu

cat > /etc/logrotate.d/nginx <<'CONF'
/var/log/nginx/*.log {
    daily
    rotate 14
    nodateext
    compress
    delaycompress
    missingok
    notifempty
    create 0640 nginx adm
    sharedscripts
    postrotate
        nginx -s reopen
    endscript
}
CONF
nginx -s reopen
