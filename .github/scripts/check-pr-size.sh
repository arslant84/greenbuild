#!/usr/bin/env bash
# Fails when a pull request changes more lines than CLAUDE.md allows.
# Generated files and migrations do not count toward the limit.
set -euo pipefail

base_sha="${1:?usage: check-pr-size.sh <base-sha> [max-lines] [head-ref]}"
max_changed_lines="${2:-400}"
head_ref="${3:-HEAD}"

changed_lines=$(
  git diff --numstat "${base_sha}...${head_ref}" -- . \
    ':(exclude)pnpm-lock.yaml' \
    ':(exclude)**/go.sum' \
    ':(exclude)packages/db/migrations/**' |
    awk '{ added += $1; removed += $2 } END { print added + removed + 0 }'
)

echo "Changed lines: ${changed_lines} (limit ${max_changed_lines})"

if [ "${changed_lines}" -gt "${max_changed_lines}" ]; then
  echo "::error::PR changes ${changed_lines} lines; the limit is ${max_changed_lines}. Split it into smaller PRs."
  exit 1
fi
