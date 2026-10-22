#!/bin/sh
# Exit 0 when the price job, as shipped and run as its user in a clean environment, gets the vendor's
# library from the system loader, and the host's other programs still find theirs. The output is shown
# to the player: what is wrong, never how.
set -u

app=$(ls /srv | grep -E '^(pricing|quotes|offers)$' | head -n 1)
job="/usr/local/bin/$app-prices"
prices="/srv/$app/prices.txt"

expected_job="#!/bin/sh
# The nightly price list: runs the vendor's pricer, as the $app user.
/opt/vendor/bin/pricer > /srv/$app/prices.txt 2>> /var/log/$app/prices.log"
if [ -z "$app" ] || [ "$(cat "$job" 2> /dev/null)" != "$expected_job" ]; then
  echo "the price job was changed"
  exit 1
fi
if grep -rqs LD_LIBRARY_PATH /etc/profile /etc/profile.d /etc/environment; then
  echo "the library is found through the environment, not the system's loader"
  exit 1
fi
if find / -xdev -name 'libpricer.so*' -type f ! -path '/opt/vendor/*' | grep -q .; then
  echo "the vendor's library was copied out of its release"
  exit 1
fi

su -s /bin/sh "$app" -c "rm -f $prices"
su -s /bin/sh "$app" -c "env -i PATH=/usr/bin:/bin $job" > /dev/null 2>&1
if [ "$(cat "$prices" 2> /dev/null)" != "pricer 4.2" ]; then
  echo "the price job still fails"
  exit 1
fi
if ! curl --version > /dev/null 2>&1; then
  echo "other programs on this host no longer start"
  exit 1
fi
echo "the price job runs, and the rest of the host is fine"
