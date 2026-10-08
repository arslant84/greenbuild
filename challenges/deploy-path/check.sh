#!/bin/sh
# Exit 0 when the shipped release is live and the deploy script, run as the pipeline runs it (with no
# environment of its own), ships a new release too. The output is shown to the player: what is wrong,
# never how.
set -u

. /etc/deploy.conf 2> /dev/null || { echo "the deploy configuration is missing"; exit 1; }
incoming=$(ls /var/deploy/incoming/*.tar.gz 2> /dev/null | head -1)
shipped=$(tar -xzOf "$incoming" index.html 2> /dev/null) || { echo "the release artifact is missing"; exit 1; }

if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$shipped" ]; then
  echo "the site does not serve the new release"
  exit 1
fi

build=$(mktemp -d)
probe="check $(date +%s)-$$"
printf '%s\n' "$probe" > "$build/index.html"
tar -czf "$build/probe.tar.gz" -C "$build" index.html
sleep 1
if ! env -i /usr/local/bin/deploy "$build/probe.tar.gz" > /dev/null 2>&1; then
  echo "the deploy script fails when the pipeline runs it"
  exit 1
fi
if [ "$(wget -q -T 5 -O - http://127.0.0.1/ 2> /dev/null)" != "$probe" ]; then
  echo "the deploy script does not make a release live"
  exit 1
fi
if ! grep -q "deployed probe.tar.gz" /var/log/deploy/events.log 2> /dev/null; then
  echo "the deploy script no longer records its deploys"
  exit 1
fi

echo "releases ship again"
