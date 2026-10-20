#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "reports invoices payroll" | cut -d' ' -f $((seed % 3 + 1)))
rows=$((150000 + seed % 50000))

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/srv/$app/public" "/var/log/$app"
chown "$app:$app" "/var/log/$app"

cat > "/srv/$app/public/export.php" <<PHP
<?php
// The monthly export: builds every row in memory, then sends the CSV.
const ROWS = $rows;

\$rows = [];
for (\$i = 0; \$i < ROWS; \$i++) {
    \$rows[] = sprintf("%06d,customer-%d,%d.%02d", \$i, \$i, \$i % 997, \$i % 100);
}
header("Content-Type: text/csv");
echo "rows," . count(\$rows) . "\n";
PHP
printf '<?php echo "%s is up\n";\n' "$app" > "/srv/$app/public/index.php"

# SEC-104: the hardening baseline every pool gets.
cat > "/etc/php83/php-fpm.d/$app.conf" <<CONF
[$app]
user = $app
group = $app
listen = 127.0.0.1:9000
pm = static
pm.max_children = 2

; SEC-104 hardening baseline
php_admin_value[memory_limit] = 32M
php_admin_flag[expose_php] = off
php_admin_flag[log_errors] = on
php_admin_value[error_log] = /var/log/$app/php-error.log
CONF

# OPS-2210: the export ran out of memory; the fix went into php.ini.
sed -i 's/^memory_limit = .*/memory_limit = 256M/' /etc/php83/php.ini
echo "$(date -u +%FT%TZ) OPS-2210: monthly export out of memory; raised memory_limit to 256M in php.ini, restarted php-fpm" >> /var/log/ops.log

cat > "/etc/nginx/http.d/$app.conf" <<CONF
server {
    listen 80 default_server;
    root /srv/$app/public;
    index index.php;

    location ~ \.php\$ {
        try_files \$uri =404;
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }
}
CONF

php-fpm83
mkdir -p /run/nginx
nginx
rm -f "$0"
