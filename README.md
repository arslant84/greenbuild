# Green Build

A daily game for DevOps and cloud engineers where proven skill becomes a public certificate.

- Architecture and MVP plan: [docs/architecture.md](docs/architecture.md)
- Progress against the plan: [docs/progress.md](docs/progress.md)

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js: players, profiles, company dashboard |
| `apps/api` | NestJS modular monolith |
| `apps/worker` | Rating, alerts, retention jobs |
| `apps/sandbox-engine` | Go: control plane and WebSocket proxy |
| `apps/sandbox-agent` | Go: agent on sandbox nodes |
| `packages/shared` | Types, zod schemas, constants, errors |
| `packages/db` | Drizzle schema, migrations, seeds |
| `packages/challenge-spec` | Challenge JSON schema and validator |
| `packages/queue` | Queue message contracts (JSON Schema) |
| `packages/ui` | Shared UI components |
| `packages/config` | ESLint, tsconfig, Prettier |
| `challenges/` | Challenge sources |
| `infra/terraform` | Infrastructure as code |
| `infra/docker` | Sandbox base images, local dev compose |
| `docs/` | ADRs, legal, runbooks |

## Requirements

- Node.js 22 and pnpm 10
- Go 1.27+ and golangci-lint 2 (sandbox engine and agent)
- Docker

## Commands

```sh
pnpm install
pnpm dev        # build once, then run every service with reload (Go services restart only with pnpm dev)
pnpm lint
pnpm typecheck
pnpm test
```

Local addresses under `pnpm dev`:

| Service | Address |
|---|---|
| Web | http://localhost:3001 |
| API | http://localhost:3000/health |
| Worker | http://localhost:3002/health |
| Sandbox engine | http://127.0.0.1:8080/health |
| Sandbox agent | http://127.0.0.1:8081/health |

## Try a sandbox by hand

Needs Docker running. Opens a shell in a fresh sandbox with the agent's isolation; the sandbox is destroyed when you `exit`.

```sh
cd apps/sandbox-agent
go run ./cmd/sandbox-shell                                   # plain alpine:3
# a challenge, broken with seed 4242 (build its image first with challenges/verify-challenge.sh):
go run ./cmd/sandbox-shell -image greenbuild-challenge/nginx-502-upstream:verify -seed 4242 -cap CHOWN,SETUID,SETGID
```
