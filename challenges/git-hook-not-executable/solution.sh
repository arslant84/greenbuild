#!/bin/sh
# Reference fix used by CI: make the hook executable for its owner, and point it at a shell this host
# has; the hook itself is plain POSIX sh.
set -eu

hook=$(ls /srv/git/*.git/hooks/post-receive)
sed -i '1s|^#!/bin/bash$|#!/bin/sh|' "$hook"
chmod 0755 "$hook"
