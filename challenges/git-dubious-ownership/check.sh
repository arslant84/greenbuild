#!/bin/sh
# Exit 0 when a new release pushed to origin goes live through the deploy job, run as root's cron runs it,
# with the checkout still the deploy user's and git not trusting every repository. The output is shown to
# the player: what is wrong, never how.
set -u

site=$(ls /srv | grep -v '^git$' | head -n 1)
port=$(sed -n 's/^# Serves .* on port \([0-9]*\) as .*/\1/p' "/usr/local/bin/$site-serve" 2> /dev/null)
release="check-$(date +%s)"
work=$(mktemp -d)
chown deploy "$work"
trap 'rm -rf "$work"' EXIT

if [ "$(stat -c %U "/srv/$site" "/srv/$site/.git" 2> /dev/null | sort -u)" != "deploy" ]; then
  echo "the site's checkout no longer belongs to the deploy user"
  exit 1
fi
trusted=$(git config --system --get-all safe.directory 2> /dev/null; HOME=/root git config --global --get-all safe.directory 2> /dev/null)
if echo "$trusted" | grep -qx '\*' || grep -q 'safe.directory=\*' "/usr/local/bin/deploy-$site"; then
  echo "git trusts every repository on the server"
  exit 1
fi
# A new release, pushed the way the team pushes.
su -s /bin/sh deploy -c "git clone -q /srv/git/$site.git $work/repo && cd $work/repo && echo $release > public/VERSION && git add -A && git -c user.name=ci -c user.email=ci@example.com commit -qm 'Release $release' && git push -q origin main" > /dev/null 2>&1
# Cron's environment: root, its home, a short PATH.
if ! env -i HOME=/root PATH=/usr/local/bin:/usr/bin:/bin "/usr/local/bin/deploy-$site" > /dev/null 2>&1; then
  echo "the deploy job still fails"
  exit 1
fi
if [ "$(wget -q -T 5 -O - "http://127.0.0.1:$port/VERSION" 2> /dev/null)" != "$release" ]; then
  echo "the site does not serve the latest release"
  exit 1
fi
echo "the deploy job puts new releases live again"
