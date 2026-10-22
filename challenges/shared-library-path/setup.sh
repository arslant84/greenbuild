#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "pricing quotes offers" | cut -d' ' -f $((seed % 3 + 1)))

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/srv/$app" "/var/log/$app" /opt/vendor/bin
chown "$app:$app" "/srv/$app" "/var/log/$app"
ln -s /opt/vendor/pricer-4.2/bin/pricer /opt/vendor/bin/pricer

cat > "/usr/local/bin/$app-prices" <<SCRIPT
#!/bin/sh
# The nightly price list: runs the vendor's pricer, as the $app user.
/opt/vendor/bin/pricer > /srv/$app/prices.txt 2>> /var/log/$app/prices.log
SCRIPT
chmod 0755 "/usr/local/bin/$app-prices"

# VEND-77: pricer 4.1 came as a package that put its library in /usr/local/lib; 4.2 ships as a tarball.
echo "$(date -u +%FT%TZ) VEND-77: upgraded pricer 4.1 -> 4.2 from the vendor tarball into /opt/vendor/pricer-4.2; removed the 4.1 package" >> /var/log/ops.log
su -s /bin/sh "$app" -c "/usr/local/bin/$app-prices" || true
rm -f "$0"
