#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "billing catalog search" | cut -d' ' -f $((seed % 3 + 1)))
release=$((40 + seed % 50))
timeout=$((20 + seed % 21))
upstream="/srv/git/$app.git"
checkout="/srv/$app"

adduser -D -s /bin/sh deploy
mkdir -p /srv/git "$checkout" "/var/log/$app"
chown deploy:deploy /srv/git "$checkout" "/var/log/$app"

as_deploy() {
  su -s /bin/sh deploy -c "set -e; $1"
}

# A release as a commit pushed by CI from its own clone.
push_release() {
  as_deploy "work=\$(mktemp -d)
    git clone -q $upstream \$work 2> /dev/null
    cd \$work
    mkdir -p config
    printf '[app]\nversion = $1\nupstream_timeout = $2\n' > config/app.ini
    git add config/app.ini
    git -c user.name=CI -c user.email=ci@$app.local commit -q -m '$3'
    git push -q origin HEAD:main"
}

as_deploy "git init -q --bare -b main $upstream"
push_release "$((release - 1))" 5 "Release $((release - 1))"
as_deploy "git clone -q $upstream $checkout"

cat > "/usr/local/bin/$app-deploy" <<SCRIPT
#!/bin/sh
# The deploy job: brings the $app checkout up to date with main, as the deploy user.
cd $checkout
git pull --ff-only origin main >> /var/log/$app/deploy.log 2>&1
SCRIPT
chmod 0755 "/usr/local/bin/$app-deploy"

# INC-5521: last night's hotfix, made in place on the server.
sed -i "s/^upstream_timeout = 5\$/upstream_timeout = $timeout/" "$checkout/config/app.ini"
echo "$(date -u +%FT%TZ) INC-5521: $app upstream calls timing out; raised upstream_timeout to $timeout in $checkout/config/app.ini, on the server (to be upstreamed)" >> /var/log/ops.log
push_release "$release" "$timeout" "Release $release: upstream_timeout $timeout (INC-5521)"
# The job's last runs since the release.
for _ in 1 2 3; do
  as_deploy "echo '--- $(date -u +%FT%TZ)' >> /var/log/$app/deploy.log; /usr/local/bin/$app-deploy" || true
done
rm -f "$0"
