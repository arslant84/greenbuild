# ADR-004: Redis Streams as the queue between the API and the engine

Status: Proposed (task 38, awaiting the owner's approval)

## Context

The TypeScript API asks the Go engine to create and destroy sandboxes and hears back when they are ready, failed or destroyed. The queue must be neutral to language, survive a consumer restart and be cheap at MVP scale.

## Decision

- Redis Streams with consumer groups in the MVP; Azure Service Bus when load requires it.
- Streams: `sandbox.create` and `sandbox.destroy` (API → engine), `sandbox.status` (engine → API), `attempt.finished` (API via outbox and worker).
- Each message carries a `version`. JSON Schemas in `packages/queue/schemas` are the source of truth for the payloads.
- Delivery is at least once: consumers acknowledge after the work is done, and handlers are idempotent (a redelivered `sandbox.create` gets the same sandbox; status changes only move forward).

## Consequences

- Redis is already needed for leaderboards and rate limits, so the queue adds no new service.
- Moving to Service Bus changes the transport, not the message contracts.
- The Go types and the TypeScript zod copies are written by hand and checked against the schemas (ADR-010).
