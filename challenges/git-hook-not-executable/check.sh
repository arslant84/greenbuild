#!/bin/sh
# Exit 0 when a push to main, made by the git user like developers make it, is deployed by the
# repository's hook, running as that user, and nobody else can rewrite the hook. The output is shown to
# the player: what is wrong, never how.
set -u

app=$(ls /srv | grep -E '^(blog|wiki|landing)$' | head -n 1)
repo="/srv/git/$app.git"
hook="$repo/hooks/post-receive"
site="/srv/$app/current"
nonce=$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')

if [ -z "$app" ] || [ ! -f "$hook" ]; then
  echo "the repository no longer deploys on push"
  exit 1
fi
if [ "$(stat -c %U "$hook")" != git ] || [ $(( $(stat -c %a "$hook") % 10 & 2 )) -ne 0 ]; then
  echo "the deploy hook can be changed by anyone"
  exit 1
fi

su -s /bin/sh git -c "set -e
  work=\$(mktemp -d)
  git clone -q $repo \$work
  cd \$work
  echo $nonce > check-$nonce.txt
  git add check-$nonce.txt
  git -c user.name=check -c user.email=check@localhost commit -q -m 'Check $nonce'
  git push -q origin HEAD:main" > /dev/null 2>&1

if [ ! -f "$site/check-$nonce.txt" ]; then
  echo "a push to main is still not deployed"
  exit 1
fi
if [ "$(stat -c %U "$site/check-$nonce.txt")" != git ]; then
  echo "the deploy does not run as the git user"
  exit 1
fi
echo "pushes to main are deployed again"
