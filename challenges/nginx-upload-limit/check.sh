#!/bin/sh
# Exit 0 when the store accepts and keeps a 20 MB artifact, and still refuses a far bigger one. The
# output is shown to the player: what is wrong, never how.
set -u

readonly ARTIFACT_BYTES=20971520       # 20 MB, the biggest artifact the team ships
readonly OVERSIZED_BYTES=157286400     # 150 MB, which no artifact needs

store=$(sed -n 's#^ *location /\([a-z]*\)/ {$#\1#p' /etc/nginx/conf.d/store.conf 2> /dev/null)
if [ -z "$store" ]; then
  echo "the artifact store's configuration is missing"
  exit 1
fi
if ! pgrep -f 'nginx: master' > /dev/null; then
  echo "nginx is not running"
  exit 1
fi

work=$(mktemp -d)
head -c "$ARTIFACT_BYTES" /dev/urandom > "$work/artifact.bin"
name="check-$$.bin"
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -T "$work/artifact.bin" "http://127.0.0.1/$store/$name")
case "$status" in
  201 | 204) ;;
  *)
    echo "a 20 MB upload fails with HTTP $status"
    exit 1
    ;;
esac
if [ "$(curl -s --max-time 10 "http://127.0.0.1/$store/$name" | sha256sum)" != "$(sha256sum < "$work/artifact.bin")" ]; then
  echo "an uploaded artifact does not come back intact"
  exit 1
fi

# nginx refuses a body by its declared length before reading it, so this costs no upload time.
printf 'x' > "$work/small"
status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X PUT -H "Content-Length: $OVERSIZED_BYTES" --data-binary @"$work/small" "http://127.0.0.1/$store/oversized.bin")
if [ "$status" != "413" ]; then
  echo "the store accepts uploads of any size"
  exit 1
fi

echo "uploads work again"
