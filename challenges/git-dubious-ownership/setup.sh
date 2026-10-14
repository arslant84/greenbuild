#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

site=$(echo "docs status handbook" | cut -d' ' -f $((seed % 3 + 1)))
port=$((8000 + seed % 1000))
minor=$((2 + seed % 7))
as_deploy() { su -s /bin/sh deploy -c "$1"; }

adduser -D -s /bin/sh deploy
mkdir -p /srv/git "/srv/$site" /var/log/deploy
chown deploy /srv/git "/srv/$site"

# The team's repository (origin) and the server's checkout, both the deploy user's.
as_deploy "git init -q --bare -b main /srv/git/$site.git"
as_deploy "git clone -q /srv/git/$site.git /tmp/$site-work 2> /dev/null"
publish() {
  as_deploy "cd /tmp/$site-work && mkdir -p public && echo '$1' > public/VERSION && printf '<h1>$site</h1><p>release %s</p>\n' '$1' > public/index.html && git add -A && git -c user.name=ci -c user.email=ci@example.com commit -qm 'Release $1' && git push -q origin main"
}
publish "1.$((minor - 1)).0"
as_deploy "git clone -q /srv/git/$site.git /srv/$site"

cat > "/usr/local/bin/deploy-$site" <<SCRIPT
#!/bin/sh
# Deploys $site: brings /srv/$site up to origin's main. Root's cron runs it every 5 minutes.
cd /srv/$site || exit 1
if ! out=\$(git pull --ff-only -q origin main 2>&1); then
  echo "\$(date -u +%FT%TZ) deploy failed: \$out" >> /var/log/deploy/$site.log
  exit 1
fi
echo "\$(date -u +%FT%TZ) deployed \$(cat public/VERSION)" >> /var/log/deploy/$site.log
SCRIPT
chmod 0755 "/usr/local/bin/deploy-$site"
echo "*/5 * * * * /usr/local/bin/deploy-$site" >> /etc/crontabs/root

cat > "/usr/local/bin/$site-serve" <<SCRIPT
#!/bin/sh
# Serves /srv/$site/public on port $port as the deploy user.
su -s /bin/sh deploy -c "cd /srv/$site/public && nohup python3 -m http.server $port --bind 127.0.0.1 > /dev/null 2>&1 &"
SCRIPT
chmod 0755 "/usr/local/bin/$site-serve"
"$site-serve"

# Yesterday the deploys ran as the deploy user; since the server was rebuilt, root's cron runs them.
"deploy-$site" || true
publish "1.$minor.0"
"deploy-$site" || true
"deploy-$site" || true
rm -rf "/tmp/$site-work"
rm -f "$0"
