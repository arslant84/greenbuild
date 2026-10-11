# ADR-007: Candidates are invisible until they opt in, and share per request

Status: Proposed (task 38, awaiting the owner's approval)

## Context

greenbuild is a hiring marketplace built on top of a game. Players trust it with their activity; companies want to find them. GDPR and CCPA/CPRA require a lawful basis, minimal data and self-service rights.

## Decision

- Privacy by default: `user_settings.discovery_mode` is `hidden` until the player chooses `passive` or `open` (with an 18+ confirmation).
- In search, companies see only an anonymous card (skill ratings, solved counts, activity, Verified mark) until the candidate accepts a contact request.
- Each accepted request reveals only the fields the candidate picks to that one company, until revoked.
- Every consent is recorded by document version in `consents`; the player can see the history, export everything and delete the account.
- Search never returns personal fields before acceptance, checked by contract tests.

## Consequences

- Marketplace supply depends on players choosing to open up, so the game must be worth playing on its own.
- Consent tables come before any company feature (task 31a).
- Data minimisation: no birth date, no address, raw session logs deleted after 90 days.
