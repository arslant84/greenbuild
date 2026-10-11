#!/usr/bin/env bash
# Regenerates the Go code for the agent contract. Commit the result; CI fails when the committed
# code does not match agent.proto (.github/scripts/check-grpc-codegen.sh).
# Needs on PATH the protoc, protoc-gen-go and protoc-gen-go-grpc versions the CI step "Check
# generated gRPC code" installs (.github/workflows/ci.yml); the same commands work locally.
set -euo pipefail
cd "$(dirname "$0")"

protoc \
  --go_out=. --go_opt=paths=source_relative \
  --go-grpc_out=. --go-grpc_opt=paths=source_relative \
  agent/v1/agent.proto
