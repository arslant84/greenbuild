#!/bin/sh
# Exit 0 when signing in through nginx hands the browser the whole session the app issued, and the page after
# it accepts that session. The output is shown to the player: what is wrong, never how.
set -u

readonly MIN_SESSION_BYTES=5000   # the identity provider's session is never smaller

app=$(ls /srv | grep -E '^(intranet|portal|wiki)$' | head -n 1)
token=$(cat "/srv/$app/session.token" 2> /dev/null)
work=$(mktemp -d)

if [ -z "$app" ] || [ "${#token}" -lt "$MIN_SESSION_BYTES" ]; then
  echo "signing in no longer issues the identity provider's whole session"
  exit 1
fi
if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi
status=$(curl -s -o /dev/null -D "$work/headers" -w '%{http_code}' --max-time 5 "http://127.0.0.1/cgi-bin/login")
if [ "$status" != "200" ]; then
  echo "signing in fails with HTTP $status"
  exit 1
fi
if ! grep -qF "session=$token;" "$work/headers"; then
  echo "the session the browser gets is not the one the app issued"
  exit 1
fi
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H "Cookie: theme=dark; session=$token" "http://127.0.0.1/cgi-bin/account")
if [ "$status" != "200" ]; then
  echo "the first page after signing in fails with HTTP $status"
  exit 1
fi
echo "signing in works again"
