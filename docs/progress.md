# Progress

Where the build stands against [architecture.md](architecture.md). Update this file in the same PR as the work it describes.

Last updated: 2026-10-02

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
| 2 | Container with limits | Done | 2a: `Spec` → Docker config (runtime, no network, all caps dropped, no-new-privileges, CPU/memory/PID limits), `SANDBOX_AGENT_RUNTIME`. 2b: `Manager.CreateSandbox`/`Destroy` via the Docker client; start failures remove the container; integration test passes on Docker with runc. 2c: CI job "Sandbox integration (gVisor)" installs pinned gVisor (checksum-verified) and runs the same test under runsc |
| 3 | First challenge | Done | `challenges/nginx-502-upstream` (nginx proxies to the wrong port; seed picks ports and app user), 3 hints and a write-up. `challenges/verify-challenge.sh`: broken after setup, setup.sh removed, solved by solution.sh, for 3 seeds, under sandbox isolation |
| 4 | Setup and TTL | Done | 4a: `Spec.Capabilities` → `CapAdd`, limited to an allowlist (CHOWN, DAC_OVERRIDE, FOWNER, KILL, NET_BIND_SERVICE, SETGID, SETUID). 4b: `Manager.RunSetup` runs `/opt/greenbuild/setup.sh <seed>` via exec, then the agent deletes it; failures return `ErrSetupFailed` with the output tail (max 4 KB). 4c: `Spec.TTL` required; deadline (TTL + 2 min) stored as the `greenbuild.deadline` container label; the agent's reaper destroys expired or deadline-less sandboxes every 10 s, so it survives agent restarts and needs no control plane |
| 5 | Terminal (PTY) | Done | 5a: `Manager.OpenTerminal` starts `/bin/sh` with a PTY (TERM=xterm-256color); `Terminal` gives input, output, `Resize` and the exit code. Integration test drives a real shell: tty size before/after resize, `exit 3`. Under gVisor the size given at exec creation is ignored and termios fails until a resize, so `OpenTerminal` resizes right after start (as the Docker CLI does). 5b: `internal/console` (raw mode, size, resize watching) and `cmd/sandbox-shell` (see README): creates a sandbox, optionally runs setup with a seed, attaches the local terminal, destroys the sandbox on exit. Verified with piped input; interactive use needs a human check |
| 6 | gRPC and mTLS | Done | 6a: `packages/agent-api` — `agent.proto` (CreateSandbox, Destroy, Exec bidi stream, CopyIn, Health), generated Go (`generate.sh`; protoc 36.0, protoc-gen-go v1.36.12, protoc-gen-go-grpc 1.6.2), contract tests. 6b-1: `packages/devpki` (moved from the agent in task 7a) + `go run ./cmd/devcerts` write a throwaway CA, agent (server) and engine (client) certs to `.certs/` (git-ignored; CA key never written; server/client usages cannot be swapped). 6b-2: `internal/mtls.ServerConfig` requires a client cert from the CA with client-auth usage, TLS 1.3 only; handshake tests cover the accepted case and 4 rejections. 6c-0: gRPC address and TLS file settings. 6c-1: `internal/agentserver` (CreateSandbox with optional setup and cleanup on failure, Destroy, Health; errors mapped to gRPC codes without leaking details); the agent starts it on `SANDBOX_AGENT_GRPC_ADDR` only when all three `SANDBOX_AGENT_TLS_*` paths are set. 6c-2a: `CopyIn` writes files through exec stdin (gVisor-safe); paths must be absolute and clean, modes at most 0777. 6c-2b: `Exec` streams a terminal (ExecStart first; stdin and resize in; output then exit code out; client EOF ends the session). 6d: end-to-end test over mTLS on real Docker: a client with a certificate calls Health, CreateSandbox, CopyIn, Exec (script output, exit 4) and Destroy; a client without one is refused. Runs in the gVisor CI job (`./...`). |
| 7 | Control plane skeleton | Done | 7a: `devpki` moved to `packages/devpki` (#32). 7b: engine config for the agent address, server name and TLS files (#33); `internal/agentclient` dials the agent over mTLS (TLS 1.3, verifies the agent's name and CA) with Health, CreateSandbox, Destroy (#34). 7c: integration test builds and starts the real agent process with dev certs; the engine creates a sandbox through it (checked with `docker inspect`) and destroys it; runs in the gVisor CI job |
| 8 | WebSocket proxy | In progress | 8a: `internal/attachtoken` verifies attach JWTs (HS256 only, audience `sandbox-attach`, sandbox/attempt/user required, exp and iat required, lifetime ≤ 60 s) with `github.com/golang-jwt/jwt/v5`; `SANDBOX_ENGINE_ATTACH_SECRET` (≥ 32 bytes, empty keeps /attach off) (#36). 8b: `agentclient.OpenTerminal` streams Exec from the engine side (Write, Resize, Recv output or exit code, CloseInput, Close) (#37). 8c-1: `internal/attach` handler (token before upgrade, binary keystrokes/output, JSON resize and exit frames, 64 KB message cap). Next: 8c-2 wiring and real-agent check |
| 9–16 | Remaining slice | Not started | |

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
- `CLAUDE.md` is kept locally and ignored by git (owner's decision, 2026-10-01); the size limits stay enforced by ESLint, golangci-lint, CI and Husky.
- No branch protection (private repo on the free plan); Claude merges PRs with `gh` only when every check is green. Merged branches are deleted automatically.
- Local development runs sandboxes with `runc` (architecture.md: dev uses Docker without gVisor); gVisor is verified in CI. The agent defaults to `runsc` and warns at startup otherwise.
- Docker access through `github.com/moby/moby/api` and `client` (the maintained successor of `github.com/docker/docker`).

## Open items

- Sandbox limits still to add from architecture.md: open-file limit, disk limit, read-only root where the challenge allows, seccomp profile, user namespaces.
- `verify-challenge.sh` reads only flat manifest lines; proper parsing and a JSON schema belong to `packages/challenge-spec` with the challenge CI pipeline.
- On Windows, stopping `pnpm dev` can leave the `go run` child binaries running (seen: an old `sandbox-agent.exe` holding port 8081). Prefer building Go apps once and running the binary in `dev`.
- The agent's reaper is the only TTL enforcement; architecture.md also wants the agent to kill sandboxes at 100% CPU for over 60 s (not started).
- `internal/console` implements raw mode with `golang.org/x/sys` (already a dependency) because `golang.org/x/term` could not be downloaded (golang.org blocked on this network); switch to `x/term` when it is reachable. Raw mode exists for Linux and Windows only.
- CI does not yet check that generated `*.pb.go` match `agent.proto`; add a step that runs `generate.sh` and fails on a diff.
- wrapcheck flags `status.Error`, which must stay unwrapped for gRPC; handled with one documented `nolint` in `agentserver.grpcError`. Adding `status.Error` to wrapcheck's ignore list would be cleaner but changes lint config (needs approval).
- gRPC stop uses `GracefulStop`, which waits for open streams; once Exec streams exist, add a timeout and fall back to `Stop`.
- Attach tokens are reusable until they expire (≤ 60 s); single use needs a shared jti store (Redis) once the engine runs more than one replica.
- gVisor is pinned in CI (`GVISOR_RELEASE` in `ci.yml`); bump it deliberately in its own PR.
- Run the agent integration test locally with `pnpm --filter @greenbuild/sandbox-agent test:integration` (needs Docker running).
- Network: GitHub, npm and the Go proxy are blocked on some networks (filtered upstream, not by Windows); check connectivity before tasks that download dependencies.
- Add `eslint-config-next` once the web app has real UI.
- Strip tokens and passwords from logs before request or DB logging is added.
- Agent and engine duplicate ~60 lines (config loading, health, graceful shutdown); apps cannot import each other. Revisit if a shared Go package under `packages/` becomes worthwhile.
