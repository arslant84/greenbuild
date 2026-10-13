# Play a challenge locally

Runs the whole Stage 1 slice on one machine: Postgres and Redis (Docker Compose), the sandbox agent, the engine, the API, the worker and the web app. Sandboxes use runc locally; gVisor is covered in CI.

## Needs

Docker, Go, Node 22 and pnpm, with `pnpm install` done once. Stop `pnpm dev` first: it uses the same ports, and only one `next dev` can run per folder.

## Run

```sh
pnpm play:up      # builds, starts everything, prints the URL
pnpm play:down    # stops everything and removes the sandboxes this stack started
```

Then open <http://localhost:3001>. A dev session starts on the first visit. Press **Start Challenge**, wait for the sandbox, fix the site in the terminal and press **Check Solution** (or Cmd/Ctrl+Enter). The result opens from the scorecard's link.

On Windows, `play:up` runs the script with Git Bash (found next to `git.exe`), never with WSL's `bash`: WSL would run it inside Linux, where the Windows Docker, Go and Node are not found. Without Git for Windows it stops and says so.

The first `play:up` builds the Go binaries, the dev certificates, the API and one image per challenge (`greenbuild-challenge/<id>:<version>`), which takes a few minutes; later runs are faster.

## What it sets up

| Service | Address | Notes |
|---|---|---|
| Web | `localhost:3001` | `next dev`, so the dev session exists |
| API | `127.0.0.1:3000` | dev user tokens on |
| Worker | `127.0.0.1:3002` | relays `attempt.finished`, publishes the daily challenge |
| Engine | `127.0.0.1:8080` | consumer on, `/attach` and `/internal` on |
| Agent | `127.0.0.1:8081`, gRPC `9443` | runc; labels its sandboxes `greenbuild.stack=play-<web port>` |
| Postgres | `127.0.0.1:15432` | migrated and seeded with every challenge; nginx-502 is the daily challenge on the stack's first day, the worker picks the following days |
| Redis | `127.0.0.1:16379` | clear of a local Redis on 6379 (e.g. Memurai) |

Each port can be changed with `PLAY_WEB_PORT`, `PLAY_API_PORT`, `PLAY_WORKER_PORT`, `PLAY_ENGINE_PORT`, `PLAY_AGENT_PORT` and `PLAY_AGENT_GRPC_PORT`, e.g. to run next to `pnpm dev`.

Everything else lives in `.play/` (git-ignored): binaries, dev certificates, throwaway secrets kept across restarts, process ids and one log per service in `.play/logs`. If a service does not come up, the script stops and prints the end of its log.

## What protects what

- The terminal opens only with a 60-second attach token, which the API issues to the attempt's owner and the engine verifies.
- Every API call carries the dev user token from the session cookie; the browser never sees it, and writes also need the `x-greenbuild-request` header.
- Dev sessions exist only outside production and only with `DEV_AUTH_SECRET`. Auth.js login replaces them.

## Signing in

The stack also runs Auth.js sign-in (tasks 30a, 54), alongside the dev session until task 30e. Open <http://localhost:3001/api/auth/signin> (Auth.js's own page until the sign-in screens, task 30b):

- **Email link:** the email goes to Mailpit, not to a real mailbox. Read it at <http://localhost:18025>.
- **GitHub or Google:** offered only when an OAuth app's id and secret are set in the shell before `pnpm play:up` (`AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`). The app's callback URL is `http://localhost:3001/api/auth/callback/github` or `.../google`. Never commit these values.

A signed-in player calls the API as themselves; without signing in, the dev session is used.

## A rejected dev session

The dev session cookie (`gb_dev_session`) is signed with `DEV_AUTH_SECRET`. If the secret changes (for example after deleting `.play/`), the old cookie is refused: the screens show the service error and API calls answer 401, and the web app does not replace a cookie that is present. Delete the cookie and reload: in the browser's developer tools, Application (Chrome) or Storage (Firefox) › Cookies › `http://localhost:3001` › `gb_dev_session`; or use a private window. Auth.js sign-in replaces dev sessions (task 30e).

## End-to-end test

With the stack up, `pnpm --filter @greenbuild/web test:e2e` plays nginx-502 in Chromium from Start to the debrief (`apps/web/e2e/slice.pw.ts`). Install the browser once with `pnpm --filter @greenbuild/web exec playwright install chromium`. Set `PLAY_WEB_URL` when the web app is not on `http://localhost:3001`. CI's "Slice e2e (Playwright)" job runs the same test on a fresh stack.
