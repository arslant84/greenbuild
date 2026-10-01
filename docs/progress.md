# Progress

Where the build stands against [architecture.md](architecture.md). Update this file in the same PR as the work it describes.

Last updated: 2026-10-01

## Stage 0 — foundation and demand

| Item from architecture.md | Status | Notes |
|---|---|---|
| Monorepo, `CLAUDE.md`, linters with size limits, CI | Done | CI green on #7; broken on `main` since #8 by parallel golangci-lint runs, fixed in `fix/golangci-parallel` |
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
| 1 | Agent skeleton | Done | Passed in CI on #7 |
| 2 | Container with limits | In progress | 2a: `Spec` → Docker config (runtime, no network, all caps dropped, no-new-privileges, CPU/memory/PID limits), `SANDBOX_AGENT_RUNTIME`. 2b: `Manager.CreateSandbox`/`Destroy` via the Docker client; start failures remove the container; integration test passes on Docker with runc. 2c: CI job "Sandbox integration (gVisor)" installs pinned gVisor (checksum-verified) and runs the same test under runsc |
| 3 | First challenge | In progress | `challenges/nginx-502-upstream` (nginx proxies to the wrong port; seed picks ports and app user) and `challenges/verify-challenge.sh`: broken after setup, setup.sh removed, solved by solution.sh, for 3 seeds, under sandbox isolation. Next: hints and write-up |
| 4–16 | Remaining slice | Not started | |

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
| — | PR size check in CI, Husky pre-commit | #11 |
| — | `docs/progress.md` | #8 (merged as part of the worker stack) |
| — | `apps/sandbox-engine` skeleton | #8 (merged as part of the worker stack) |
| S7 | `apps/worker` skeleton | #8 |
| — | `pnpm dev` runs all services (TS reload via `tsc --watch` + `node --watch`) | #9 |
| — | Let both Go linters run in parallel (`--allow-parallel-runners`) | `fix/golangci-parallel` |

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
- No branch protection (private repo on the free plan); Claude merges PRs with `gh` only when every check is green. Merged branches are deleted automatically.
- Local development runs sandboxes with `runc` (architecture.md: dev uses Docker without gVisor); gVisor is verified in CI. The agent defaults to `runsc` and warns at startup otherwise.
- Docker access through `github.com/moby/moby/api` and `client` (the maintained successor of `github.com/docker/docker`).

## Open items

- Sandbox limits still to add from architecture.md: open-file limit, disk limit, read-only root where the challenge allows, seccomp profile, user namespaces.
- Challenge manifests list extra capabilities (`capabilities:`); the agent's `Spec` does not read them yet, so it needs `CapAdd` before it can run nginx-502-upstream.
- `verify-challenge.sh` reads only flat manifest lines; proper parsing and a JSON schema belong to `packages/challenge-spec` with the challenge CI pipeline.
- gVisor is pinned in CI (`GVISOR_RELEASE` in `ci.yml`); bump it deliberately in its own PR.
- Run the agent integration test locally with `pnpm --filter @greenbuild/sandbox-agent test:integration` (needs Docker running).
- Network: GitHub, npm and the Go proxy are blocked on some networks (filtered upstream, not by Windows); check connectivity before tasks that download dependencies.
- Add `eslint-config-next` once the web app has real UI.
- Strip tokens and passwords from logs before request or DB logging is added.
- Agent and engine duplicate ~60 lines (config loading, health, graceful shutdown); apps cannot import each other. Revisit if a shared Go package under `packages/` becomes worthwhile.
