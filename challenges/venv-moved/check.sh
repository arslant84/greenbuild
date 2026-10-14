#!/bin/sh
# Exit 0 when the service, restarted with its start script, runs as its own user on its release's
# virtualenv and answers, without a build directory brought back. The output is shown to the player:
# what is wrong, never how.
set -u

app=$(ls /srv | head -n 1)
port=$(sed -n 's/^# Starts .* on port \([0-9]*\)\..*/\1/p' "/usr/local/bin/$app-start" 2> /dev/null)
answers() {
  wget -q -T 1 -O - "http://127.0.0.1:$port/health" 2> /dev/null | grep -q '^acme-reports 2.3.0'
}

if [ -z "$port" ]; then
  echo "the service's start script is missing"
  exit 1
fi
# A fresh start, as after the next reboot. Python starts slowly under gVisor: up to 10 s.
pkill -u "$app" > /dev/null 2>&1
sleep 1
"/usr/local/bin/$app-start" > /dev/null 2>&1
for _ in $(seq 50); do
  answers && break
  sleep 0.2
done
if ! answers; then
  echo "the service does not start with its start script"
  exit 1
fi
# The newest: PID 1 never reaps, so a killed one stays behind as a zombie with an empty command line.
pid=$(pgrep -n -u "$app" -f acme-reports)
if [ -z "$pid" ]; then
  echo "the service is not running as its own user"
  exit 1
fi
case "$(tr '\0' '\n' < "/proc/$pid/cmdline" | head -n 1)" in
  "/srv/$app/venv/bin/python"*) ;;
  *) echo "the service does not run on its release's virtualenv"; exit 1 ;;
esac
if ls -d /opt/build-* > /dev/null 2>&1; then
  echo "the release depends on a build directory again"
  exit 1
fi
echo "the service starts from its release again"
