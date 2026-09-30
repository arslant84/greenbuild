# Green Build

A daily game for DevOps and cloud engineers where proven skill becomes a public certificate.

- Architecture and MVP plan: [docs/architecture.md](docs/architecture.md)
- Engineering rules: [CLAUDE.md](CLAUDE.md)

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
- Go 1.23+ (sandbox engine and agent)
- Docker

## Commands

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```
