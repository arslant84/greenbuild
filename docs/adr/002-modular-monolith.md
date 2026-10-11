# ADR-002: The API is a modular monolith

Status: Proposed (task 38, awaiting the owner's approval)

## Context

The API covers attempts, challenges, hints, catalog and, later, users, ratings, companies and consent. Traffic in stages 0–2 is small, and the team is one owner plus an AI assistant.

## Decision

- One NestJS service (`apps/api`) with clear modules inside it.
- Modules talk to each other only through their exported service, never through another module's internal files or tables.
- The API is stateless: all state lives in PostgreSQL and Redis, so copies are interchangeable.
- A module becomes its own service only when it actually hits a load limit.

## Consequences

- One deployable, one database connection pool, transactions across modules where needed (for example the outbox written in the same transaction as an attempt's final status).
- Boundaries are kept by the lint rule that forbids importing `**/modules/*/internal/*` and by review, not by the network.
- Splitting a module out later means turning its exported service into a client; the call sites stay.
