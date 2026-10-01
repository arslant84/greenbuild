#!/usr/bin/env bash
# Regenerates the Go code for the agent contract. Commit the result.
# Needs protoc 36.0, protoc-gen-go v1.36.12 and protoc-gen-go-grpc 1.6.2 on PATH:
#   go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.12
#   go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.2
set -euo pipefail
cd "$(dirname "$0")"

protoc \
  --go_out=. --go_opt=paths=source_relative \
  --go-grpc_out=. --go-grpc_opt=paths=source_relative \
  agent/v1/agent.proto
