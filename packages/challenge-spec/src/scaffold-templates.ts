// The files `pnpm challenges:new <id>` writes (task 53). They pass `challenges:validate`; check.sh fails
// until the author writes it, so an unfinished challenge cannot pass verify-challenge.sh.
// docs/runbooks/challenge-authoring.md is the checklist.

export function manifestTemplate(id: string): string {
  return `# yaml-language-server: $schema=../../packages/challenge-spec/challenge.schema.json
id: ${id}
version: 1
title: "Write the incident title"
statement: "Write what the player sees: the symptom, never the cause."
difficulty: 3            # 1–10
skills: { linux: 1 }     # weights add up to 1
time_limit_sec: 900
resources:
  cpu: 500m
  memory: 512Mi
  disk: 1Gi
network: none            # none | allowlist
capabilities: []         # only what the service needs, e.g. [CHOWN, SETUID, SETGID]
randomize:               # applied by setup.sh from the attempt seed
  port: { range: [4000, 4999] }
check:
  command: /opt/greenbuild/check.sh
  timeout_sec: 20
  run_as: root           # the checker is not visible to the user
hints: 3
source: human            # human | ai | community
`;
}

export const DOCKERFILE_TEMPLATE = `FROM alpine:3

COPY --chmod=0755 setup.sh /opt/greenbuild/setup.sh

# The agent runs setup.sh with the attempt seed; until then the container only waits.
CMD ["sleep", "infinity"]
`;

export const SETUP_TEMPLATE = `#!/bin/sh
# Breaks the environment for one attempt. The agent runs it once with the attempt seed, and it deletes itself.
set -eu

seed="\${1:?usage: setup.sh <seed>}"
case "$seed" in
  '' | *[!0-9]*) echo "seed must be a non-negative integer" >&2; exit 2 ;;
esac

port=$((4000 + seed % 1000))
echo "set up the incident here (port $port)" > /dev/null

rm -f "$0"
`;

export const CHECK_TEMPLATE = `#!/bin/sh
# Exit 0 when the incident is fixed. Check the outcome, not the method, and refuse workarounds.
# The output is shown to the player: what is wrong, never how to fix it.
set -u

echo "this challenge's check is not written yet"
exit 1
`;

export const SOLUTION_TEMPLATE = `#!/bin/sh
# Reference fix used by CI: verify-challenge.sh runs it, then expects check.sh to pass.
set -eu
`;

export const HINTS_TEMPLATE = `# Hints

## Hint 1

Where to look first, without naming the cause.

## Hint 2

What to compare or which command shows the difference.

## Hint 3

What to change, still without a ready command.
`;

export function readmeTemplate(id: string): string {
  return `# ${id}

## What was broken

The cause, and why it shows up the way it does.

## How to find it

The logs, configs and commands that lead to it.

## The fix

The reference fix, explained.

## What not to do

Workarounds the check refuses, and why.
`;
}
