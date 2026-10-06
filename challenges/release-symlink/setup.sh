#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "shop docs portal" | cut -d' ' -f $((seed % 3 + 1)))
day=$((seed % 28 + 1))
# Four deploys over two nights: two that worked, one that failed its build, and last night's.
older=$(printf '202609%02d-1010' "$day")
good=$(printf '202609%02d-1645' "$day")
failed=$(printf '202609%02d-0205' "$((day + 1))")
broken=$(printf '202609%02d-0230' "$((day + 1))")
base="/srv/$app"
log=/var/log/deploy/deploy.log

adduser -D -H -s /sbin/nologin deploy
mkdir -p "$base/releases" /var/log/deploy

for release in "$older" "$good"; do
  mkdir -p "$base/releases/$release"
  printf '%s %s\n' "$app" "$(printf 'greenbuild-release-%s-%s' "$seed" "$release" | sha256sum | cut -c1-16)" \
    > "$base/releases/$release/index.html"
  printf '%s\n' "$release" > "$base/releases/$release/REVISION"
  printf '[%s] build ok\n[%s] current -> releases/%s\n' "$release" "$release" "$release" >> "$log"
done

# The failed build is kept for debugging: no page was ever built into it.
mkdir -p "$base/releases/$failed/assets"
printf '%s\n' "$failed" > "$base/releases/$failed/REVISION"
printf '[%s] build failed: asset compilation exited with 137 (out of memory)\n' "$failed" >> "$log"
printf '[%s] release kept for debugging; current stays on releases/%s\n' "$failed" "$good" >> "$log"

# Last night's deploy switched current before building (DEP-118), then removed its own release.
ln -sfn "$base/releases/$broken" "$base/current"
printf '[%s] current -> releases/%s\n' "$broken" "$broken" >> "$log"
printf '[%s] build failed: asset compilation exited with 137 (out of memory)\n' "$broken" >> "$log"
printf '[%s] cleanup: removed releases/%s\n' "$broken" "$broken" >> "$log"
chown -R deploy:deploy "$base" /var/log/deploy

cat > "/etc/nginx/conf.d/$app.conf" <<CONF
server {
    listen 80 default_server;
    root $base/current;
}
CONF

nginx
rm -f "$0"
