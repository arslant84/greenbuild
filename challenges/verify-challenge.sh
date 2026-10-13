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
# The agent's NofileLimit (apps/sandbox-agent/internal/sandbox/spec.go), soft and hard.
readonly NOFILE_LIMIT=8192
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
randomized=$(node -e 'console.log(Object.keys(JSON.parse(process.argv[1]).randomize).length)' "${manifest_json}")
cap_add_flags=()
for capability in "${capabilities[@]}"; do
  cap_add_flags+=(--cap-add "${capability}")
done

start_sandbox() {
  docker run -d --runtime "${runtime}" --network none --cap-drop ALL "${cap_add_flags[@]}" \
    --security-opt no-new-privileges --pids-limit "${PIDS_LIMIT}" --ulimit "nofile=${NOFILE_LIMIT}:${NOFILE_LIMIT}" \
    --cpus "${cpus}" --memory "${docker_memory}" --memory-swap "${docker_memory}" "${image}"
}

# no_answers_in_image fails when the image ships a checker or a solution: the checker is copied in
# only for a check, and players must never find either.
no_answers_in_image() {
  local found
  found=$(docker exec "${container_id}" find / -xdev \( -name check.sh -o -name solution.sh \) -print 2> /dev/null || true)
  [ -z "${found}" ] || fail "the image contains ${found//$'\n'/, }; check.sh and solution.sh must never ship in it"
}

# environment_fingerprint hashes every file setup may have changed. Volatile paths, and the files
# Docker writes for each container, would differ between any two runs, so they are left out.
environment_fingerprint() {
  docker exec "${container_id}" sh -c 'find / -xdev \( -path /tmp -o -path /run -o -path /var/run -o -path /var/log -o -path /var/cache \
    -o -path /etc/hostname -o -path /etc/hosts -o -path /etc/resolv.conf \) -prune -o -type f -exec sha256sum {} + | sort | sha256sum'
}

run_script() {
  docker cp "${challenge_dir}/$1" "${container_id}:/opt/greenbuild/$1"
  docker exec "${container_id}" sh "/opt/greenbuild/$1"
}

verify_seed() {
  local seed="$1"
  container_id=$(start_sandbox)
  no_answers_in_image
  docker exec "${container_id}" /opt/greenbuild/setup.sh "${seed}"
  fingerprints+=("$(environment_fingerprint)")

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

case "${challenge_dir}" in
  *zombie-reports*)
    set +e +o pipefail
    docker build -q -t "${image}" "${challenge_dir}" > /dev/null
    for limit in 256 512; do
      container_id=$(docker run -d --runtime "${runtime}" --network none --cap-drop ALL "${cap_add_flags[@]}" \
        --security-opt no-new-privileges --pids-limit "${limit}" --cpus "${cpus}" --memory "${docker_memory}" "${image}")
      started=0
      while [ "${started}" -lt 300 ]; do
        docker exec "${container_id}" sh -c 'for i in $(seq 25); do sleep 600 & done' > /dev/null 2>&1
        started=$((started + 25))
        alive=$(docker inspect -f '{{.State.Running}}' "${container_id}")
        count=$(docker exec "${container_id}" sh -c 'ps -o pid | wc -l' 2>&1 | tail -1)
        echo "EXP pids-limit ${limit}: started ${started}, running=${alive}, guest processes ${count}"
        [ "${alive}" = "true" ] || break
      done
      docker rm -f "${container_id}" > /dev/null
    done
    exit 0 ;;
  *challenges/*) echo "EXP skip ${challenge_dir}"; exit 0 ;;
esac
docker build -q -t "${image}" "${challenge_dir}" > /dev/null
echo "verifying ${image} with runtime ${runtime} (cpus ${cpus}, memory ${docker_memory}, caps: ${capabilities[*]})"
fingerprints=()
for seed in "${seeds[@]}"; do
  verify_seed "${seed}"
done
# A challenge that randomizes values must leave a different environment for different seeds.
if [ "${randomized}" -gt 0 ] && [ "${#seeds[@]}" -gt 1 ] && [ "$(printf '%s\n' "${fingerprints[@]}" | sort -u | wc -l)" -eq 1 ]; then
  fail "challenge.yaml randomizes values, but every seed left the same environment"
fi
echo "PASS: ${#seeds[@]} seeds"
