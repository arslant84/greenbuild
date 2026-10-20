#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "docs contracts media" | cut -d' ' -f $((seed % 3 + 1)))
bundle_kb=$((3072 + seed % 3072))

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/srv/$app" "/var/log/$app" /run/mysqld
chown "$app:$app" "/var/log/$app"
chown mysql:mysql /run/mysqld
head -c "$((bundle_kb * 1024))" /dev/urandom > "/srv/$app/bundle.bin"
chmod 0644 "/srv/$app/bundle.bin"

# DBA-219: sized for the small instance.
sed -i 's/^\[mysqld\]$/[mysqld]\nmax_allowed_packet = 1M/' /etc/my.cnf.d/mariadb-server.cnf
cat > /etc/my.cnf.d/import.cnf <<CNF
# OPS-1307: the nightly import fails with "Got a packet bigger than 'max_allowed_packet' bytes".
[mysql]
max_allowed_packet = 64M
CNF

cat > /usr/local/bin/db-restart <<'SCRIPT'
#!/bin/sh
# Restarts MariaDB and waits until it answers.
if mariadb-admin ping > /dev/null 2>&1 && ! mariadb-admin shutdown; then
  echo "MariaDB did not stop" >&2
  exit 1
fi
for _ in $(seq 20); do
  pgrep -f '^/usr/bin/mariadbd ' > /dev/null || break
  sleep 0.5
done
(mariadbd-safe --user=mysql > /dev/null 2>&1 &)
for _ in $(seq 60); do
  mariadb-admin ping > /dev/null 2>&1 && exit 0
  sleep 0.5
done
echo "MariaDB did not start" >&2
exit 1
SCRIPT
chmod 0755 /usr/local/bin/db-restart

mariadb-install-db --user=mysql --datadir=/var/lib/mysql > /dev/null 2>&1
db-restart
mariadb <<SQL
CREATE DATABASE $app;
CREATE TABLE $app.bundles (id INT AUTO_INCREMENT PRIMARY KEY, loaded_at DATETIME NOT NULL, body LONGBLOB NOT NULL);
CREATE USER '$app'@'localhost' IDENTIFIED VIA unix_socket;
GRANT INSERT, SELECT ON $app.bundles TO '$app'@'localhost';
SQL

cat > "/usr/local/bin/$app-import" <<SCRIPT
#!/bin/sh
# The nightly import: loads the document bundle into the $app database, as the $app user.
{
  printf "INSERT INTO bundles (loaded_at, body) VALUES (NOW(), FROM_BASE64('"
  base64 -w 0 /srv/$app/bundle.bin
  printf "'));\n"
} | mariadb --skip-print-query-on-error $app 2>> /var/log/$app/import.log
SCRIPT
chmod 0755 "/usr/local/bin/$app-import"
su -s /bin/sh "$app" -c "/usr/local/bin/$app-import" || true
echo "$(date -u +%FT%TZ) OPS-1307: raised max_allowed_packet to 64M for the $app import" >> /var/log/ops.log
rm -f "$0"
