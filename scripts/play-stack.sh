#!/usr/bin/env bash
# Runs the whole Stage 1 slice on one machine: Postgres and Redis (Docker Compose), the sandbox agent
# (runc), the engine, the API and the web app. Used by `pnpm play:up` / `pnpm play:down` and by CI's
# Playwright job. State, logs and throwaway secrets live in .play/ (git-ignored).
#
#   bash scripts/play-stack.sh up     # then open http://localhost:3001
#   bash scripts/play-stack.sh down
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLAY="$ROOT/.play"
COMPOSE=(docker compose -f "$ROOT/infra/docker/play-stack.compose.yaml")
CHALLENGE_IMAGE="greenbuild-challenge/nginx-502-upstream:dev"
READY_TIMEOUT_S=120
# Defaults match each service's own defaults; override them to run next to another local stack.
WEB_PORT="${PLAY_WEB_PORT:-3001}"
API_PORT="${PLAY_API_PORT:-3000}"
ENGINE_PORT="${PLAY_ENGINE_PORT:-8080}"
AGENT_PORT="${PLAY_AGENT_PORT:-8081}"
AGENT_GRPC_PORT="${PLAY_AGENT_GRPC_PORT:-9443}"

log() { printf '[play] %s\n' "$*"; }

# secrets writes three random secrets once, so restarts keep sessions and tokens valid.
secrets() {
  if [ ! -f "$PLAY/secrets.env" ]; then
    {
      echo "ATTACH_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
      echo "INTERNAL_TOKEN=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
      echo "DEV_AUTH_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    } > "$PLAY/secrets.env"
  fi
  # shellcheck disable=SC1091
  source "$PLAY/secrets.env"
}

build() {
  log "building agent, engine, certificates and the nginx-502 image"
  (cd "$ROOT/apps/sandbox-agent" && go build -o "$PLAY/bin/sandbox-agent" ./cmd/sandbox-agent && go run ./cmd/devcerts -out "$PLAY/certs" >/dev/null)
  (cd "$ROOT/apps/sandbox-engine" && go build -o "$PLAY/bin/sandbox-engine" ./cmd/sandbox-engine)
  docker build -q -t "$CHALLENGE_IMAGE" "$ROOT/challenges/nginx-502-upstream" >/dev/null
  log "building the API and the database package"
  (cd "$ROOT" && pnpm --filter "@greenbuild/api..." build >/dev/null)
}

database() {
  log "starting Postgres and Redis"
  "${COMPOSE[@]}" up -d --wait >/dev/null
  log "migrating and seeding"
  (cd "$ROOT/packages/db" && DATABASE_URL="$DATABASE_URL" node dist/migrate.js && DATABASE_URL="$DATABASE_URL" node dist/seed.js)
}

# start runs one service in the background with its output in .play/logs/<name>.log.
start() {
  local name="$1"
  shift
  (cd "$ROOT" && env "$@" > "$PLAY/logs/$name.log" 2>&1 & echo $! > "$PLAY/pids/$name")
}

wait_for() {
  local name="$1" url="$2" deadline=$((SECONDS + READY_TIMEOUT_S))
  until curl -sf -o /dev/null "$url"; do
    if [ "$SECONDS" -gt "$deadline" ]; then
      log "$name did not start; last log lines:"
      tail -n 20 "$PLAY/logs/$name.log"
      exit 1
    fi
    sleep 1
  done
  log "$name is up ($url)"
}

services() {
  local certs="$PLAY/certs"
  start agent SANDBOX_AGENT_RUNTIME=runc SANDBOX_AGENT_TLS_CA="$certs/ca.pem" SANDBOX_AGENT_TLS_CERT="$certs/agent.pem" \
    SANDBOX_AGENT_TLS_KEY="$certs/agent-key.pem" "$PLAY/bin/sandbox-agent"
  wait_for agent http://127.0.0.1:8081/health
  start engine SANDBOX_ENGINE_TLS_CA="$certs/ca.pem" SANDBOX_ENGINE_TLS_CERT="$certs/engine.pem" SANDBOX_ENGINE_TLS_KEY="$certs/engine-key.pem" \
    SANDBOX_ENGINE_ATTACH_SECRET="$ATTACH_SECRET" SANDBOX_ENGINE_INTERNAL_TOKEN="$INTERNAL_TOKEN" SANDBOX_ENGINE_CHALLENGES_DIR="$ROOT/challenges" \
    SANDBOX_ENGINE_REDIS_URL="$REDIS_URL" SANDBOX_ENGINE_ALLOWED_ORIGINS="localhost:$WEB_PORT,127.0.0.1:$WEB_PORT"     SANDBOX_ENGINE_HTTP_ADDR="127.0.0.1:$ENGINE_PORT" SANDBOX_ENGINE_AGENT_ADDR="127.0.0.1:$AGENT_GRPC_PORT" "$PLAY/bin/sandbox-engine"
  wait_for engine "http://127.0.0.1:$ENGINE_PORT/health"
  start api NODE_ENV=development PORT=3000 DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" ATTACH_SECRET="$ATTACH_SECRET" \
    ENGINE_INTERNAL_URL=http://127.0.0.1:8080 ENGINE_INTERNAL_TOKEN="$INTERNAL_TOKEN" DEV_AUTH_SECRET="$DEV_AUTH_SECRET" node apps/api/dist/main.js
  wait_for api http://127.0.0.1:3000/health
  # next dev, not next start: the dev session exists only outside production builds.
  start web API_URL=http://127.0.0.1:3000 DEV_AUTH_SECRET="$DEV_AUTH_SECRET" ENGINE_ATTACH_URL=ws://127.0.0.1:8080/attach \
    pnpm --filter @greenbuild/web exec next dev --port 3001
  wait_for web http://127.0.0.1:3001/health
}

# stop ends a service and its children (next dev starts several node processes). On Windows the
# process tree belongs to native processes, so it is ended by its Windows PID.
stop() {
  local pid winpid
  pid="$(cat "$1")"
  if command -v taskkill >/dev/null 2>&1; then
    winpid="$(ps -p "$pid" 2>/dev/null | awk 'NR == 2 { print $4 }')"
    taskkill //PID "${winpid:-$pid}" //T //F >/dev/null 2>&1 || true
  else
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$1"
}

up() {
  mkdir -p "$PLAY/bin" "$PLAY/certs" "$PLAY/logs" "$PLAY/pids"
  secrets
  DATABASE_URL="postgres://postgres:play@127.0.0.1:55432/greenbuild"
  REDIS_URL="redis://127.0.0.1:56379"
  build
  database
  services
  log "ready: open http://localhost:$WEB_PORT (logs in .play/logs, stop with: pnpm play:down)"
}

down() {
  for pidfile in "$PLAY"/pids/web "$PLAY"/pids/api "$PLAY"/pids/engine "$PLAY"/pids/agent; do
    if [ -f "$pidfile" ]; then stop "$pidfile"; fi
  done
  "${COMPOSE[@]}" down >/dev/null 2>&1 || true
  log "stopped"
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  *) echo "usage: $0 [up|down]" >&2; exit 2 ;;
esac
