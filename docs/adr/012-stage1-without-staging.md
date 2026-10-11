# ADR-012: Stage 1 was built before staging

Status: Proposed (task 38, awaiting the owner's approval). Accepted by the owner as deviation 1 in `architecture.md`.

## Context

The plan's Stage 0 gate asked for Terraform and a staging environment before Stage 1. The owner chose to build the playable vertical slice first.

## Decision

- Stage 1 was built without Terraform and staging. Task 16's "works in staging" became "works on the local stack (`pnpm play:up`) and in the Playwright CI job".
- Staging and the task 16 path in it are tasks 28a–28h.
- While GitHub Actions cannot run (owner, 2026-10-08), merges need the same checks to pass locally on the rebased branch (lint, typecheck, tests, Playwright for web changes, `verify-challenge.sh` for changed challenges), and the PR says CI and gVisor were not run.

## Consequences

- The game loop was proven early, on one machine.
- The Stage 1 gate (p95 start, failed starts, 20 solvers) cannot be measured until staging exists; `pnpm report:gate` (39a) is ready for it.
- gVisor, Azure networking and managed identities are untested in a real environment until then.
