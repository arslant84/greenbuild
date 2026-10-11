#!/usr/bin/env bash
# Fails when the committed gRPC code does not match agent.proto (architecture.md, task 37a): someone
# changed the contract without running packages/agent-api/generate.sh. Needs the generator versions
# generate.sh names on PATH.
set -euo pipefail

readonly GENERATED_DIR="packages/agent-api/agent/v1"

bash packages/agent-api/generate.sh
if ! git diff --quiet -- "${GENERATED_DIR}"; then
  echo "::error::${GENERATED_DIR}/*.pb.go do not match agent.proto; run packages/agent-api/generate.sh and commit the result"
  git diff --stat -- "${GENERATED_DIR}"
  exit 1
fi
echo "generated gRPC code matches agent.proto"
