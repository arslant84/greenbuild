#!/usr/bin/env bash
# Lists the challenge folders CI must verify: all of them without a base (pushes to main), or the
# folders a pull request changes, or all of them when the verification tooling itself changed.
#   changed-challenges.sh [base-sha]
set -euo pipefail

base="${1:-}"

all_challenges() {
  for dir in challenges/*/; do
    echo "${dir%/}"
  done
}

if [ -z "${base}" ]; then
  all_challenges
  exit 0
fi

changed=$(git diff --name-only "${base}...HEAD")
if echo "${changed}" | grep -qE '^(challenges/verify-challenge\.sh|packages/challenge-spec/)'; then
  all_challenges
  exit 0
fi
echo "${changed}" | sed -n 's#^challenges/\([^/]*\)/.*#challenges/\1#p' | sort -u | while read -r dir; do
  # A deleted challenge has nothing left to verify.
  if [ -d "${dir}" ]; then
    echo "${dir}"
  fi
done
