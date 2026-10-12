# ADR-001: TypeScript everywhere, Go only in the sandbox engine

Status: Accepted (owner, 2026-10-12)

## Context

A small team builds a web game, an API, a background worker and a sandbox engine that drives containers. Most of the product is web and CRUD work; the engine talks to Docker, PTYs and gRPC and has to be fast and small.

## Decision

- Web: Next.js 16 (App Router) with Tailwind CSS 4; API: NestJS 12; worker: Node. All TypeScript, strict mode.
- Sandbox engine and node agent: Go, using `github.com/moby/moby` for Docker and gRPC with mTLS between them.
- PostgreSQL 16 through Drizzle ORM (`packages/db`), Redis for the queue and later leaderboards.
- zod schemas in `packages/shared` are the single definition of requests, responses, manifests and queue messages on the TypeScript side.
- pnpm workspaces and Turborepo; Azure first, everything described in Terraform (task 28).

## Consequences

- One language for the web, API and worker: shared types and schemas without code generation.
- Go keeps the engine a single static binary with first-class Docker and gRPC libraries.
- Two languages meet only at the queue and the engine's HTTP endpoints, so those contracts need their own checks (ADR-004, ADR-010).
