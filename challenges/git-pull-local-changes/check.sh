#!/bin/sh
# Exit 0 when the deploy job, as shipped and run as the deploy user, brings the checkout up to date with
# a release pushed now, leaving it clean and keeping the hotfix's value. The output is shown to the
# player: what is wrong, never how.
set -u

app=$(ls /srv | grep -E '^(billing|catalog|search)$' | head -n 1)
upstream="/srv/git/$app.git"
checkout="/srv/$app"
job="/usr/local/bin/$app-deploy"
nonce=$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')

as_deploy() {
  su -s /bin/sh deploy -c "$1"
}

expected_job="#!/bin/sh
# The deploy job: brings the $app checkout up to date with main, as the deploy user.
cd $checkout
git pull --ff-only origin main >> /var/log/$app/deploy.log 2>&1"
if [ -z "$app" ] || [ "$(cat "$job" 2> /dev/null)" != "$expected_job" ]; then
  echo "the deploy job was changed"
  exit 1
fi
timeout=$(as_deploy "git --git-dir=$upstream show main:config/app.ini" | sed -n 's/^upstream_timeout = //p')

# Tonight's next release, then the job.
as_deploy "set -e
  work=\$(mktemp -d)
  git clone -q $upstream \$work
  cd \$work
  echo $nonce > check-$nonce.txt
  git add check-$nonce.txt
  git -c user.name=CI -c user.email=ci@localhost commit -q -m 'Check $nonce'
  git push -q origin HEAD:main" > /dev/null 2>&1
as_deploy "$job" > /dev/null 2>&1

if [ "$(as_deploy "git -C $checkout rev-parse HEAD" 2> /dev/null)" != "$(as_deploy "git --git-dir=$upstream rev-parse main")" ]; then
  echo "the deploy job still does not bring the release in"
  exit 1
fi
if [ -n "$(as_deploy "git -C $checkout status --porcelain")" ]; then
  echo "the checkout has changes the next release may trip over"
  exit 1
fi
if ! grep -qx "upstream_timeout = $timeout" "$checkout/config/app.ini"; then
  echo "last night's hotfix was lost"
  exit 1
fi
echo "the release is deployed, and the deploy job works again"
