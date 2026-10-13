#!/usr/bin/env bash
# Runs the whole Stage 1 slice on one machine: Postgres and Redis (Docker Compose), the sandbox agent
# (runc), the engine, the API, the worker and the web app. Used by `pnpm play:up` / `pnpm play:down` and by CI's
# Playwright job. State, logs and throwaway secrets live in .play/ (git-ignored).
#
#   bash scripts/play-stack.sh up     # then open http://localhost:3001
#   bash scripts/play-stack.sh down
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAY="$ROOT/.play"
COMPOSE=(docker compose -f "$ROOT/infra/docker/play-stack.compose.yaml")
READY_TIMEOUT_S=120
# Defaults match each service's own defaults; override them to run next to another local stack.
WEB_PORT="${PLAY_WEB_PORT:-3001}"
API_PORT="${PLAY_API_PORT:-3000}"
WORKER_PORT="${PLAY_WORKER_PORT:-3002}"
ENGINE_PORT="${PLAY_ENGINE_PORT:-8080}"
AGENT_PORT="${PLAY_AGENT_PORT:-8081}"
AGENT_GRPC_PORT="${PLAY_AGENT_GRPC_PORT:-9443}"
# The agent labels its sandboxes with this, so down removes this stack's and not another's on the same
# Docker daemon; two stacks cannot share a web port.
STACK="play-$WEB_PORT"

log() { printf '[play] %s\n' "$*"; }

# secrets writes each random secret once, so restarts keep sessions and tokens valid; a secret added
# later (AUTH_SECRET, task 30a) is appended to an older secrets.env.
secrets() {
  touch "$PLAY/secrets.env"
  for name in ATTACH_SECRET INTERNAL_TOKEN DEV_AUTH_SECRET AUTH_SECRET; do
    if ! grep -q "^$name=" "$PLAY/secrets.env"; then
      echo "$name=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')" >> "$PLAY/secrets.env"
    fi
  done
  # shellcheck disable=SC1091
  source "$PLAY/secrets.env"
}

build() {
  log "building agent, engine and certificates"
  (cd "$ROOT/apps/sandbox-agent" && go build -o "$PLAY/bin/sandbox-agent" ./cmd/sandbox-agent && go run ./cmd/devcerts -out "$PLAY/certs" >/dev/null)
  (cd "$ROOT/apps/sandbox-engine" && go build -o "$PLAY/bin/sandbox-engine" ./cmd/sandbox-engine)
  log "building the API, the worker and the database package"
  (cd "$ROOT" && pnpm --filter "@greenbuild/api..." --filter "@greenbuild/worker..." build >/dev/null)
  challenge_images
}

# challenge_images builds every challenge as greenbuild-challenge/<id>:<version>, the image the
# seed records for that version; the version comes from the validated manifest.
challenge_images() {
  local dir id version
  for dir in "$ROOT"/challenges/*/; do
    id="$(basename "$dir")"
    version="$(node "$ROOT/packages/challenge-spec/dist/inspect.js" "$dir" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).version)')"
    log "building challenge $id version $version"
    docker build -q -t "greenbuild-challenge/$id:$version" "$dir" >/dev/null
  done
}

database() {
  log "starting Postgres and Redis"
  "${COMPOSE[@]}" up -d --wait >/dev/null
  log "migrating and seeding"
  (cd "$ROOT/packages/db" && DATABASE_URL="$DATABASE_URL" node dist/migrate.js && DATABASE_URL="$DATABASE_URL" node dist/seed.js)
  todays_daily
}

# todays_daily makes nginx-502 today's daily challenge when none is published yet, so the stack and its
# Playwright tests start from a known challenge; the worker publishes the following days.
todays_daily() {
  local id
  id="$(cd "$ROOT/packages/db" && node --input-type=module -e 'import { uuidv7 } from "./dist/uuid.js"; console.log(uuidv7())')"
  "${COMPOSE[@]}" exec -T postgres psql -q -U postgres -d greenbuild -c \
    "insert into daily_challenges (id, day, track, challenge_version_id) select '$id', '$(date -u +%F)', 'linux', v.id from challenge_versions v join challenges c on c.id = v.challenge_id where c.slug = 'nginx-502-upstream' order by v.version desc limit 1 on conflict do nothing" >/dev/null
}

# start runs one service in the background with its output in .play/logs/<name>.log.
start() {
  local name="$1"
  shift
  (cd "$ROOT" && env "$@" > "$PLAY/logs/$name.log" 2>&1 & echo $! > "$PLAY/pids/$name")
}

# wait_for waits until the service answers /health on its port, then remembers who listens there.
wait_for() {
  local name="$1" port="$2" deadline=$((SECONDS + READY_TIMEOUT_S))
  local url="http://127.0.0.1:$port/health"
  until curl -sf -o /dev/null "$url"; do
    # Another service on the same port could answer; ours must still be running.
    if ! kill -0 "$(cat "$PLAY/pids/$name")" 2>/dev/null || [ "$SECONDS" -gt "$deadline" ]; then
      log "$name did not start; last log lines:"
      tail -n 20 "$PLAY/logs/$name.log"
      exit 1
    fi
    sleep 1
  done
  sleep 1
  if ! kill -0 "$(cat "$PLAY/pids/$name")" 2>/dev/null; then
    log "$name exited; is its port taken by another process? Last log lines:"
    tail -n 20 "$PLAY/logs/$name.log"
    exit 1
  fi
  remember_listener "$name" "$port"
  log "$name is up ($url)"
}

# On Windows the recorded PID is Git Bash's wrapper, not the native process. Once our service is up
# (and still alive), the process listening on its port is ours, so its Windows PID is kept for down.
remember_listener() {
  if command -v taskkill >/dev/null 2>&1; then
    netstat -ano | awk -v port=":$2" '$1 == "TCP" && $4 == "LISTENING" && substr($2, length($2) - length(port) + 1) == port { print $5; exit }' > "$PLAY/pids/$1.win"
  fi
}

services() {
  local certs="$PLAY/certs"
  start agent SANDBOX_AGENT_RUNTIME=runc SANDBOX_AGENT_TLS_CA="$certs/ca.pem" SANDBOX_AGENT_TLS_CERT="$certs/agent.pem" \
    SANDBOX_AGENT_TLS_KEY="$certs/agent-key.pem" SANDBOX_AGENT_HEALTH_ADDR="127.0.0.1:$AGENT_PORT" \
    SANDBOX_AGENT_GRPC_ADDR="127.0.0.1:$AGENT_GRPC_PORT" SANDBOX_AGENT_STACK="$STACK" "$PLAY/bin/sandbox-agent"
  wait_for agent "$AGENT_PORT"
  start engine SANDBOX_ENGINE_TLS_CA="$certs/ca.pem" SANDBOX_ENGINE_TLS_CERT="$certs/engine.pem" SANDBOX_ENGINE_TLS_KEY="$certs/engine-key.pem" \
    SANDBOX_ENGINE_ATTACH_SECRET="$ATTACH_SECRET" SANDBOX_ENGINE_INTERNAL_TOKEN="$INTERNAL_TOKEN" SANDBOX_ENGINE_CHALLENGES_DIR="$ROOT/challenges" \
    SANDBOX_ENGINE_REDIS_URL="$REDIS_URL" SANDBOX_ENGINE_ALLOWED_ORIGINS="localhost:$WEB_PORT,127.0.0.1:$WEB_PORT" \
    SANDBOX_ENGINE_HTTP_ADDR="127.0.0.1:$ENGINE_PORT" SANDBOX_ENGINE_AGENT_ADDR="127.0.0.1:$AGENT_GRPC_PORT" "$PLAY/bin/sandbox-engine"
  wait_for engine "$ENGINE_PORT"
  start api NODE_ENV=development PORT="$API_PORT" DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" ATTACH_SECRET="$ATTACH_SECRET" \
    ENGINE_INTERNAL_URL="http://127.0.0.1:$ENGINE_PORT" ENGINE_INTERNAL_TOKEN="$INTERNAL_TOKEN" DEV_AUTH_SECRET="$DEV_AUTH_SECRET" \
    node apps/api/dist/main.js
  wait_for api "$API_PORT"
  # The worker relays attempt.finished and publishes the daily challenge (task 41a).
  start worker NODE_ENV=development PORT="$WORKER_PORT" DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" node apps/worker/dist/main.js
  wait_for worker "$WORKER_PORT"
  # next dev, not next start: the dev session exists only outside production builds.
  # Sign-in (task 30a): email links go to Mailpit; GitHub only when AUTH_GITHUB_ID/SECRET are set.
  start web API_URL="http://127.0.0.1:$API_PORT" DEV_AUTH_SECRET="$DEV_AUTH_SECRET" ENGINE_ATTACH_URL="ws://127.0.0.1:$ENGINE_PORT/attach" \
    AUTH_SECRET="$AUTH_SECRET" AUTH_URL="http://localhost:$WEB_PORT" DATABASE_URL="$DATABASE_URL" \
    EMAIL_SERVER="smtp://127.0.0.1:11025" EMAIL_FROM="sign-in@greenbuild.dev" \
    bash -c "cd apps/web && exec ./node_modules/.bin/next dev --port $WEB_PORT"
  wait_for web "$WEB_PORT"
}

# stop ends a service and its children (next dev starts several node processes); on Windows by the
# listener's Windows PID that wait_for recorded.
stop() {
  local pid
  pid="$(cat "$1")"
  if [ -s "$1.win" ]; then
    taskkill //PID "$(cat "$1.win")" //T //F >/dev/null 2>&1 || true
    rm -f "$1.win"
  fi
  if ! command -v taskkill >/dev/null 2>&1; then
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$1"
}

up() {
  mkdir -p "$PLAY/bin" "$PLAY/certs" "$PLAY/logs" "$PLAY/pids"
  secrets
  DATABASE_URL="postgres://postgres:play@127.0.0.1:15432/greenbuild"
  REDIS_URL="redis://127.0.0.1:16379"
  build
  database
  services
  log "ready: open http://localhost:$WEB_PORT (logs in .play/logs, stop with: pnpm play:down)"
}

down() {
  for pidfile in "$PLAY"/pids/web "$PLAY"/pids/worker "$PLAY"/pids/api "$PLAY"/pids/engine "$PLAY"/pids/agent; do
    if [ -f "$pidfile" ]; then stop "$pidfile"; fi
  done
  # The agent is gone before its TTL reaper removes the sandboxes it started.
  local sandboxes
  sandboxes="$(docker ps -aq --filter "label=greenbuild.stack=$STACK" 2>/dev/null || true)"
  if [ -n "$sandboxes" ]; then docker rm -f $sandboxes >/dev/null; fi
  "${COMPOSE[@]}" down >/dev/null 2>&1 || true
  log "stopped"
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  *) echo "usage: $0 [up|down]" >&2; exit 2 ;;
esac
