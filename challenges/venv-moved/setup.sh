#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "reports exports metrics" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8000 + seed % 1000))
build="/opt/build-$((1000 + seed % 9000))"

adduser -D -H -s /sbin/nologin "$app"
mkdir -p "/srv/$app" "/var/log/$app" /var/log/deploy
chown "$app" "/var/log/$app"

# The release pipeline: build the virtualenv in a scratch directory, copy it into the release, clean up.
python3 -m venv "$build/venv"
"$build/venv/bin/pip" install --quiet --no-index --find-links /opt/wheels acme-reports
cp -a "$build/venv" "/srv/$app/venv"
rm -rf "$build"
{
  echo "$(date -u +%FT%TZ) release $app 2.3.0: built virtualenv in $build/venv"
  echo "$(date -u +%FT%TZ) release $app 2.3.0: copied $build/venv to /srv/$app/venv"
  echo "$(date -u +%FT%TZ) release $app 2.3.0: removed $build"
} >> /var/log/deploy/release.log

cat > "/usr/local/bin/$app-start" <<SCRIPT
#!/bin/sh
# Starts $app from its release as its user on port $port. Output: /var/log/$app/app.log.
su -s /bin/sh $app -c "nohup /srv/$app/venv/bin/acme-reports --port $port >> /var/log/$app/app.log 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$app-start"

"$app-start"
sleep 1
rm -f "$0"
