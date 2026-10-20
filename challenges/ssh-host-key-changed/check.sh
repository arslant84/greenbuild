#!/bin/sh
# Exit 0 when the job, unchanged and as its own user, pushes a report to the archive host, the job trusts
# exactly the archive's new host key, still knows the build mirror, and no ssh setting skips host key
# checks. The output is shown to the player: what is wrong, never how.
set -u

app=$(ls /home | grep -E '^(reports|billing|analytics)$' | head -n 1)
ssh_dir="/home/$app/.ssh"
known="$ssh_dir/known_hosts"
incoming=/srv/archive/incoming
archive_host=$(cut -d' ' -f1 /opt/greenbuild/archive-host)

if [ -z "$app" ] || ! pgrep -x dropbear > /dev/null; then
  echo "the archive host is not running"
  exit 1
fi
if ! sha256sum -c /opt/greenbuild/push-reports.sum > /dev/null 2>&1; then
  echo "the push job is not the one that shipped"
  exit 1
fi
if cat "$ssh_dir/config" /etc/ssh/ssh_config /etc/ssh/ssh_config.d/* 2> /dev/null | grep -iqE '^\s*(StrictHostKeyChecking\s+(no|off)|UserKnownHostsFile\s+/dev/null)'; then
  echo "ssh no longer checks who it is talking to"
  exit 1
fi
before=$(ls "$incoming" | wc -l)
if ! su "$app" -c /usr/local/bin/push-reports > /dev/null 2>&1 || [ "$(ls "$incoming" | wc -l)" -le "$before" ]; then
  echo "reports still do not reach the archive"
  exit 1
fi
if [ "$(grep -F "$archive_host " "$known" | sort -u)" != "$(cat /opt/greenbuild/archive-host)" ]; then
  echo "the job does not trust exactly the archive's new host key"
  exit 1
fi
if ! grep -qxF "$(cat /opt/greenbuild/mirror-host)" "$known"; then
  echo "the job no longer knows its other hosts"
  exit 1
fi
echo "reports reach the archive again"
