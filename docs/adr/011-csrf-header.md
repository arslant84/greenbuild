# ADR-011: CSRF protection by a required request header

Status: Proposed (task 38, awaiting the owner's approval)

## Context

The browser calls the web app's `/api/*` handlers with the session cookie, and they forward to the API. A cross-site form or link could trigger a write with that cookie.

## Decision

- Writes to `/api/*` require the header `x-greenbuild-request: 1`; the handlers refuse them without it.
- The session cookie is SameSite=Lax and httpOnly.
- No CSRF tokens until Auth.js; the choice is reviewed in task 30e.

## Consequences

- A cross-site HTML form cannot set custom headers, and a cross-site `fetch` with one needs a CORS preflight the web app does not allow, so forged writes fail.
- The web app's own calls set the header in one place per hook (for example the start, check and leave hooks).
- Simpler than token management, but it relies on browsers' CORS behaviour; Auth.js's own CSRF protection may replace it.
