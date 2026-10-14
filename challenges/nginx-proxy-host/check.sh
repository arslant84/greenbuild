#!/bin/sh
# Exit 0 when nginx reloads from its files and, under each of the site's names, the account page's "Sign in"
# link points to the sign-in page on that same name, which loads. The output is shown to the player: what is
# wrong, never how.
set -u

site=$(ls /opt 2> /dev/null | grep -v greenbuild | head -n 1)
login=$(sed -n 's/^ *body = "\([0-9a-f]\{16\}\)"$/\1/p' "/opt/$site/app.py" 2> /dev/null)

# The "Sign in" link on the account page, as a visitor of that name sees it.
sign_in_link() {
  curl -s -m 5 -H "Host: $1" http://127.0.0.1/account 2> /dev/null | sed -n 's/.*id="sign-in" href="\([^"]*\)".*/\1/p'
}

if [ -z "$login" ] || ! pgrep -u "$site" -f "/opt/$site/app.py" > /dev/null; then
  echo "the shop is not running as its own user"
  exit 1
fi
if ! nginx -t > /dev/null 2>&1 || ! nginx -s reload > /dev/null 2>&1; then
  echo "nginx does not reload from its configuration"
  exit 1
fi
sleep 1
for host in "$site.acme.test" "www.$site.acme.test"; do
  if [ "$(sign_in_link "$host")" != "http://$host/login?next=/account" ]; then
    echo "the account page on $host links to a sign-in page elsewhere"
    exit 1
  fi
  if [ "$(wget -q -T 5 -O - --header "Host: $host" 'http://127.0.0.1/login?next=/account' 2> /dev/null)" != "$login" ]; then
    echo "the sign-in page does not load on $host"
    exit 1
  fi
done
echo "customers reach the sign-in page again"
