#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

app=$(echo "blog wiki landing" | cut -d' ' -f $((seed % 3 + 1)))
release=$((2 + seed % 7))
repo="/srv/git/$app.git"
site="/srv/$app/current"

adduser -D -s /bin/sh git
mkdir -p /srv/git "$site" "/var/log/$app"
chown git:git /srv/git "$site" "/var/log/$app"

as_git() {
  su -s /bin/sh git -c "$1"
}

# A release as a commit pushed from a fresh clone, the way developers push.
push_release() {
  as_git "set -e
    work=\$(mktemp -d)
    git clone -q $repo \$work 2> /dev/null
    cd \$work
    echo '<h1>$app release $1</h1>' > index.html
    git add index.html
    git -c user.name='Release bot' -c user.email=release@$app.local commit -q -m 'Release $1'
    git push -q origin HEAD:main 2>&1"
}

as_git "git init -q --bare -b main $repo"
push_release "$((release - 1))" > /dev/null
as_git "git --git-dir=$repo --work-tree=$site checkout -q -f main"

# INFRA-342: the git server moved to a new host; hooks were copied over from the old one.
cat > "$repo/hooks/post-receive" <<HOOK
#!/bin/bash
# Deploys main into $site after every push.
set -eu
while read -r old new ref; do
  [ "\$ref" = refs/heads/main ] || continue
  git --git-dir=$repo --work-tree=$site checkout -q -f main
  echo "\$(date -u +%FT%TZ) deployed \$new" >> /var/log/$app/deploy.log
done
HOOK
chown git:git "$repo/hooks/post-receive"
chmod 0644 "$repo/hooks/post-receive"
echo "$(date -u +%FT%TZ) INFRA-342: git server moved to this host; repositories and hooks copied from the old server" >> /var/log/ops.log

push_release "$release" >> "/var/log/$app/push.log"
rm -f "$0"
