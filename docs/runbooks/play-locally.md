# Play a challenge locally

Runs the Stage 1 slice on one machine: agent, engine, Redis and the web app, with `cmd/dev-attempt` standing in for the API (until tasks 14–16). Sandboxes use runc locally; gVisor is covered in CI.

## Once

```sh
cd apps/sandbox-agent && go run ./cmd/devcerts   # writes apps/sandbox-agent/.certs (git-ignored)
docker build -t greenbuild-challenge/nginx-502-upstream:dev challenges/nginx-502-upstream
```

Pick three random secrets of at least 32 characters, e.g. `openssl rand -hex 32`.

## Environment

Use free ports. On Windows, Memurai often holds 6379, so Redis goes on 6380 here.

```sh
C=$PWD/apps/sandbox-agent/.certs
export SANDBOX_AGENT_RUNTIME=runc
export SANDBOX_AGENT_TLS_CA=$C/ca.pem SANDBOX_AGENT_TLS_CERT=$C/agent.pem SANDBOX_AGENT_TLS_KEY=$C/agent-key.pem
export SANDBOX_ENGINE_TLS_CA=$C/ca.pem SANDBOX_ENGINE_TLS_CERT=$C/engine.pem SANDBOX_ENGINE_TLS_KEY=$C/engine-key.pem
export SANDBOX_ENGINE_ATTACH_SECRET=<secret 1> SANDBOX_ENGINE_INTERNAL_TOKEN=<secret 2>
export SANDBOX_ENGINE_CHALLENGES_DIR=$PWD/challenges SANDBOX_ENGINE_REDIS_URL=redis://127.0.0.1:6380
export SANDBOX_ENGINE_ALLOWED_ORIGINS=localhost:3001
export GREENBUILD_DEV_CHECK_SECRET=<secret 3> ENGINE_INTERNAL_TOKEN=<secret 2>
```

The web app reads `ENGINE_ATTACH_URL` (default `ws://127.0.0.1:8080/attach`) and `ENGINE_INTERNAL_URL` (default `http://127.0.0.1:8080`).

## Run

In separate terminals with that environment:

```sh
docker run --rm -p 127.0.0.1:6380:6379 redis:8-alpine
cd apps/sandbox-agent && go build -o agent ./cmd/sandbox-agent && ./agent
cd apps/sandbox-engine && go build -o engine ./cmd/sandbox-engine && ./engine
cd apps/web && pnpm dev
cd apps/sandbox-engine && go run ./cmd/dev-attempt
```

`dev-attempt` prints a link. Open it within 60 seconds: the attach token is only for connecting, so a reload needs a new link. Solve the challenge in the terminal and press **Check**.

Only one `next dev` can run per folder. Stop the other one, or run the web app from a `git worktree`.

## What protects what

- The terminal opens only with the 60-second attach token, signed with `SANDBOX_ENGINE_ATTACH_SECRET`.
- **Check** sends the dev ticket (2 hours, bound to the attempt, sandbox and challenge) to the web app's `/play/{attempt}/check`. Only that route holds the engine's internal token. The route is off in production and without both secrets.
