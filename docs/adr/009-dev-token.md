# ADR-009: A temporary dev user token until Auth.js

Status: Proposed (task 38, awaiting the owner's approval)

## Context

The vertical slice needed a signed-in player before any login existed. Auth.js (GitHub and email link) needs an email provider (decision D6) and the user and consent tables.

## Decision

- Until Auth.js, the API accepts a dev user token: JWT HS256 signed with `DEV_AUTH_SECRET`, audience `greenbuild-dev-user`, subject a UUID (`apps/api/src/auth/dev-user-token.ts`).
- `DevUserGuard` checks it as the global guard behind `@CurrentUser()`; it lets nobody in under production. Public endpoints are marked `@Public()`.
- On the first `/play` visit the web app issues a random user an httpOnly, SameSite=Lax cookie `gb_dev_session` (`apps/web/src/server/dev-session.ts`); its `/api/*` handlers forward requests to the API with that token.

## Consequences

- The full player path works locally and in Playwright without an identity provider.
- It is not real authentication and must not reach production. Removal order: Auth.js issues sessions and the API checks a short-lived signed token behind the same `@CurrentUser()` (30a–30c), Playwright moves to a test sign-in provider (30d), then the dev path and `DEV_AUTH_SECRET` are deleted (30e).
