#!/usr/bin/env bash
# Posts a Terraform plan as the PR's Terraform comment, editing the previous one so each PR keeps one.
#
#   .github/scripts/terraform-plan-comment.sh <plan.txt>    (env: PR_NUMBER, COMMIT_SHA, GH_TOKEN)
set -euo pipefail

# GitHub refuses comments over 65,536 characters; the rest of the body needs a little room.
readonly MAX_PLAN_CHARS=60000

plan_file="${1:?usage: terraform-plan-comment.sh <plan.txt>}"
body="$(mktemp)"

{
  echo "### Terraform plan: staging"
  echo
  echo "Commit \`${COMMIT_SHA:?}\`. Plan only; apply runs after merge with the owner's approval."
  echo
  echo '<details><summary>Plan</summary>'
  echo
  echo '```'
  head -c "${MAX_PLAN_CHARS}" "${plan_file}"
  echo
  echo '```'
  if [ "$(wc -c < "${plan_file}")" -gt "${MAX_PLAN_CHARS}" ]; then
    echo
    echo "The plan is longer than ${MAX_PLAN_CHARS} characters and is cut; the job log has all of it."
  fi
  echo '</details>'
} > "${body}"

gh pr comment "${PR_NUMBER:?}" --edit-last --create-if-none --body-file "${body}"
