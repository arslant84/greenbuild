# ADR-010: Queue types are hand-written zod copies checked against the JSON Schemas

Status: Accepted (owner, 2026-10-12)

## Context

Queue messages are defined once as JSON Schemas in `packages/queue/schemas` and used from TypeScript and Go (ADR-004). Generating TypeScript from them would add a generator and produce types without the zod validation the API needs at the boundary.

## Decision

- The JSON Schemas stay the source of truth.
- TypeScript uses hand-written zod schemas in `packages/shared/src/queue`; Go uses hand-written types in `packages/queue`.
- Tests compare each copy with its schema (`packages/shared/src/queue/queue.test.ts`, `packages/queue/queue_test.go`), so a change to one side without the other fails.

## Consequences

- Every message is validated with zod when it enters the API or worker.
- Changing a message means editing the schema and both copies in one PR; the drift tests point at what was missed.
- If messages multiply, generation can replace the copies without changing the schemas.
