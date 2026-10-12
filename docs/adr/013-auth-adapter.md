# ADR-013: A thin Auth.js adapter in packages/db

Status: Accepted (owner, 2026-10-12)

## Context

Task 30a adds Auth.js to `apps/web` with GitHub and email-link sign-in, and task 30b records the 16+ confirmation. Auth.js needs an adapter that creates users, links sign-in accounts and stores email-link tokens. The schema from task 29a has `users` (`display_name`, `avatar_url`, lowercase `email` and `handle`) and `auth_accounts` (`provider` enum, `provider_user_id`).

The standard adapter, `@auth/drizzle-adapter` 1.11.3 (with `@auth/core` 0.41.3, as used by `next-auth` 5.0.0-beta.32), expects in its `pg` types:

- `users` columns keyed `id`, `name`, `email`, `emailVerified`, `image`;
- `accounts` keyed `userId`, `type`, `provider` (text), `providerAccountId`, plus `refresh_token`, `access_token`, `expires_at`, `token_type`, `scope`, `id_token`, `session_state`. `linkAccount` inserts the whole OAuth account object;
- `sessions` (only for database sessions) and `verificationToken`.

## Options

1. **Standard adapter with column mapping.** Define a second Drizzle view of `users` and `auth_accounts` with the adapter's keys over our columns. Add `email_verified`, a text `type`, the OAuth token columns and `verification_tokens`. GitHub emails are not lowercased by Auth.js, so inserts can break the lowercase check unless something wraps the adapter anyway.
2. **Thin own adapter in `packages/db`.** Implement only the methods JWT sessions and the email link use:
   - `createUser`, `getUser`, `getUserByEmail`, `getUserByAccount`, `updateUser`, `linkAccount`;
   - `createVerificationToken`, `useVerificationToken`.

   It maps Auth.js's `name`/`image`/`emailVerified` to our columns and lowercases emails. It stores only the provider identity, never OAuth tokens. It needs one new table, `verification_tokens`, and an `email_verified_at` column.

## Decision (proposed)

Option 2:

- **Sessions:** JWT sessions, so no `sessions` table. The API checks a short-lived ES256 token anyway (task 30c).
- **Adapter:** about 100–150 lines in `packages/db`, typed against `@auth/core`'s `Adapter`. Each method gets an integration test on PostgreSQL 16, like the other `packages/db` tests (the 30a acceptance test).
- **Migration:** additive. It adds `verification_tokens` (identifier, hashed token, expires) and `users.email_verified_at`.
- **Version:** `next-auth` 5 (Auth.js), pinned to an exact beta in 30a, because the adapter interface is `@auth/core`'s and it supports Next 16. If the owner prefers the stable 4.x line, the adapter follows its interface instead.

## Consequences

- No OAuth access or refresh tokens are stored (privacy: minimisation). Sign-in only needs the provider's user id.
- Our column names, enum and lowercase rules stay as they are; no second Drizzle view of the same tables.
- We own a small piece of auth code and its tests; upgrades of `@auth/core` must be checked against its `Adapter` type.
