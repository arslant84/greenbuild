#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "intranet portal wiki" | cut -d' ' -f $((seed % 3 + 1)))
port=$((3000 + seed % 1000))
# The new identity provider's session carries the user's group claims: 5 to 6.5 KB once encoded, more than
# nginx's default 4 KB header buffer, less than its 8 KB client header buffers.
claims_bytes=$((3800 + seed % 1000))
cgi="/srv/$app/www/cgi-bin"

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "$cgi" "/var/log/$app"
head -c "$claims_bytes" /dev/urandom | base64 | tr -d '\n' > "/srv/$app/session.token"

cat > "$cgi/login" <<SCRIPT
#!/bin/sh
# Signs the user in through the identity provider and hands the browser its session.
token=\$(cat /srv/$app/session.token)
echo "\$(date -Iseconds) sign-in alex ok, session issued (\${#token} bytes)" >> /var/log/$app/app.log
printf 'Content-Type: text/plain\r\nSet-Cookie: session=%s; Path=/; HttpOnly\r\n\r\n' "\$token"
echo "signed in"
SCRIPT
cat > "$cgi/account" <<SCRIPT
#!/bin/sh
# The first page after signing in; it needs the whole session.
case "; \${HTTP_COOKIE:-}" in
  *"; session=\$(cat /srv/$app/session.token)"*) printf 'Content-Type: text/plain\r\n\r\nsigned in as alex\n' ;;
  *) printf 'HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nnot signed in\n' ;;
esac
SCRIPT
chmod 0755 "$cgi/login" "$cgi/account"
echo "$(date -Iseconds) SSO-2210: sign-in moved to the new identity provider; sessions now carry group claims" >> "/var/log/$app/ops.log"
chown -R "$app:$app" "/srv/$app" "/var/log/$app"

cat > "/etc/nginx/conf.d/$app.conf" <<CONF
# The $app, behind nginx.
server {
    listen 80 default_server;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_set_header Host \$host;
    }
}
CONF

su -s /bin/sh "$app" -c "httpd -p 127.0.0.1:$port -h /srv/$app/www >> /var/log/$app/app.log 2>&1"
nginx
for _ in 1 2 3; do
  wget -q -O /dev/null "http://127.0.0.1/cgi-bin/login" 2> /dev/null || true
done
rm -f "$0"
