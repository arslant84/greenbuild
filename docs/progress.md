# Progress

Where the build stands against [architecture.md](architecture.md). Update this file in the same PR as the work it describes.

Last updated: 2026-09-30

## Stage 0 — foundation and demand

| Item from architecture.md | Status | Notes |
|---|---|---|
| Monorepo, `CLAUDE.md`, linters with size limits, CI | Done | CI run result on GitHub not yet confirmed (see Open items) |
| Terraform: core and sandbox networks, Container Apps, PostgreSQL, Redis, ACR, Key Vault, Blob | Not started | Approved; Terraform 1.16 installed |
| Skeletons with health check: `web` | Done | Next.js 16, `GET /health`, port 3001 |
| Skeletons with health check: `api` | Done | NestJS 12 (ESM), `GET /health`, port 3000, shared error format |
| Skeletons with health check: `sandbox-agent` | Done | Go, `GET /health` on 127.0.0.1:8081 |
| Skeletons with health check: `sandbox-engine` | Done | Go, `GET /health` on 127.0.0.1:8080; gRPC client to the agent comes with task 7 |
| Skeletons with health check: `worker` | Done | TypeScript, plain `node:http` `GET /health`, port 3002; jobs come with the queue (task 10) |
| DB schema incl. consent and company tables | Not started | Stage 1 task 13 covers the first tables |
| Mockups, design-partner calls, lawyer, ADR-001…007 | Not started | Non-code items for the founder; ADRs can be drafted on request |

## Stage 1 — vertical slice (tasks from architecture.md)

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Agent skeleton | Done | Waiting for a green CI run to meet "passes in CI" |
| 2 | Container with limits | Blocked | Network filtering blocks Go modules; Docker Desktop stopped; gVisor not installed |
| 3–16 | Remaining slice | Not started | |

## Setup steps done

| Step | What | PR |
|---|---|---|
| S1 | Root: pnpm workspaces, Turborepo, folder layout, `.gitignore`, `.editorconfig` | direct to `main` (empty repo) |
| S2 | `packages/config`: ESLint limits from CLAUDE.md, strict tsconfig, Prettier, rule tests | direct to `main` |
| S3 | `packages/shared`: error codes, `AppError` classes, `{code, message, details}` schema, constants | #2 |
| S5 | `apps/api` skeleton and global error filter | #2, #5 |
| S6 | `apps/web` skeleton | #4 |
| S8 | `apps/sandbox-agent` skeleton (= Stage 1 task 1) | #6 |
| S10 | CI: lint, typecheck, test, build | #7 |
| — | `.gitattributes` forcing LF | #3 |
| — | PR size check in CI, Husky pre-commit | `chore/enforcement` (pushed, merge status unknown) |
| — | `apps/sandbox-engine` skeleton | `feat/sandbox-engine-skeleton` (local, not pushed: network) |
| S7 | `apps/worker` skeleton | `feat/worker-skeleton` (local, stacked on the engine branch) |
| — | `pnpm dev` runs all services (TS reload via `tsc --watch` + `node --watch`) | `feat/dev-command` (local, stacked on the worker branch) |

Dropped: S4 (empty `db`, `queue`, `challenge-spec`, `ui` packages). Each package is created by the task that first needs it.

## Decisions

- Product and package name is `greenbuild`; sandbox paths use `/opt/greenbuild/`.
- TypeScript pinned to `~6.0.3`: typescript-eslint does not support 7 yet. Upgrading is a major-version change (needs approval).
- Vitest for all TypeScript tests; the API uses SWC so NestJS decorator metadata works.
- API and shared are ES modules; Node 22.12+ loads them without extra setup.
- HTTP status mapping lives in the API, not in `packages/shared`.
- Go apps are wired into `pnpm lint/typecheck/test/build` through a `package.json` per app.
- golangci-lint v2 config format.
- `@swc/core` install script stays disabled (`ignoredBuiltDependencies`).
- Turborepo agent guidance disabled; no `AGENTS.md`.
- No Claude attribution in commits or PRs.

## Open items

- Confirm the CI runs on `main` (after #7) and on the `chore/enforcement` PR are green.
- Merge `chore/enforcement`, then require "PR size" and "Lint, typecheck, test, build" in a `main` ruleset.
- Network: GitHub, npm and the Go proxy are unreachable from the current network (filtered upstream, not by Windows). Needed for task 2 onward.
- Start Docker Desktop and install gVisor (`runsc`) in the WSL2 VM for task 2.
- Add `eslint-config-next` once the web app has real UI.
- Strip tokens and passwords from logs before request or DB logging is added.
- Agent and engine duplicate ~60 lines (config loading, health, graceful shutdown); apps cannot import each other. Revisit if a shared Go package under `packages/` becomes worthwhile.
- Local branch `feat/api-skeleton` can be deleted with `git branch -D` (content is on `main`).
