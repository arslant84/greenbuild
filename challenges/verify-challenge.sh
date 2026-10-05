#!/usr/bin/env bash
# Verifies a challenge for several seeds: after setup.sh the check fails, after solution.sh it passes.
# Containers get the sandbox agent's isolation: no network, all capabilities dropped except the
# manifest's, no-new-privileges, PID/CPU/memory limits. Runtime: SANDBOX_TEST_RUNTIME (default runc).
#
#   challenges/verify-challenge.sh challenges/nginx-502-upstream [seed...]
set -euo pipefail
# Git Bash on Windows would otherwise rewrite container paths such as /opt/greenbuild.
export MSYS_NO_PATHCONV=1

readonly ROOT="$(cd "$(dirname "$0")/.." && pwd)"
readonly PIDS_LIMIT=256
# Different remainders mod 3, so seed-dependent picks (e.g. nginx-502-upstream's app_user) all get exercised.
readonly DEFAULT_SEEDS=(1 4242 98765)

challenge_dir="${1:?usage: verify-challenge.sh <challenge-dir> [seed...]}"
shift
seeds=("$@")
[ ${#seeds[@]} -gt 0 ] || seeds=("${DEFAULT_SEEDS[@]}")

image="greenbuild-challenge/$(basename "${challenge_dir}"):verify"
runtime="${SANDBOX_TEST_RUNTIME:-runc}"
container_id=""

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cleanup() {
  [ -z "${container_id}" ] || docker rm -f "${container_id}" > /dev/null
}
trap cleanup EXIT

# The manifest as JSON from packages/challenge-spec, which refuses an invalid folder first.
(cd "${ROOT}" && pnpm -s turbo run build --filter=@greenbuild/challenge-spec... > /dev/null)
# node is a Windows program under Git Bash and needs its path converted, unlike docker's container paths.
manifest_json=$(env -u MSYS_NO_PATHCONV node "${ROOT}/packages/challenge-spec/dist/inspect.js" "${challenge_dir}") || fail "${challenge_dir} is not a valid challenge"

# manifest_value prints one field by dotted path; arrays come out space-separated.
manifest_value() {
  node -e 'const value = process.argv[2].split(".").reduce((node, key) => node[key], JSON.parse(process.argv[1]));
console.log(Array.isArray(value) ? value.join(" ") : value);' "${manifest_json}" "$1"
}

cpu_millis=$(manifest_value resources.cpu)
memory=$(manifest_value resources.memory)
cpus=$(awk -v m="${cpu_millis%m}" 'BEGIN { printf "%.3f", m / 1000 }')
docker_memory="${memory%Mi}m"
read -r -a capabilities <<< "$(manifest_value capabilities)"
cap_add_flags=()
for capability in "${capabilities[@]}"; do
  cap_add_flags+=(--cap-add "${capability}")
done

start_sandbox() {
  docker run -d --runtime "${runtime}" --network none --cap-drop ALL "${cap_add_flags[@]}" \
    --security-opt no-new-privileges --pids-limit "${PIDS_LIMIT}" \
    --cpus "${cpus}" --memory "${docker_memory}" --memory-swap "${docker_memory}" "${image}"
}

run_script() {
  docker cp "${challenge_dir}/$1" "${container_id}:/opt/greenbuild/$1"
  docker exec "${container_id}" sh "/opt/greenbuild/$1"
}

verify_seed() {
  local seed="$1"
  container_id=$(start_sandbox)
  docker exec "${container_id}" /opt/greenbuild/setup.sh "${seed}"

  if docker exec "${container_id}" test -e /opt/greenbuild/setup.sh; then
    fail "seed ${seed}: setup.sh is still in the container"
  fi
  if run_script check.sh; then
    fail "seed ${seed}: check passes before the fix, so the environment is not broken"
  fi
  run_script solution.sh
  run_script check.sh || fail "seed ${seed}: check fails after solution.sh"

  docker rm -f "${container_id}" > /dev/null
  container_id=""
  echo "ok: seed ${seed}"
}

docker build -q -t "${image}" "${challenge_dir}" > /dev/null
echo "verifying ${image} with runtime ${runtime} (cpus ${cpus}, memory ${docker_memory}, caps: ${capabilities[*]})"
for seed in "${seeds[@]}"; do
  verify_seed "${seed}"
done
echo "PASS: ${#seeds[@]} seeds"
