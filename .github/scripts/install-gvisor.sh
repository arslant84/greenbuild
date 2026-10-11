#!/usr/bin/env bash
# Installs a pinned gVisor release and registers runsc as a Docker runtime.
# Meant for CI runners; it uses sudo and restarts the Docker daemon.
set -euo pipefail

release="${1:?usage: install-gvisor.sh <release date, e.g. 20260928>}"
arch="$(uname -m)"
base_url="https://storage.googleapis.com/gvisor/releases/release/${release}/${arch}"
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT
cd "${work_dir}"

curl -fsSLO "${base_url}/gvisor.tar.bz2"
curl -fsSLO "${base_url}/gvisor.tar.bz2.sha512"
# The archive is only trusted after its checksum matches.
sha512sum -c gvisor.tar.bz2.sha512

tar -xjf gvisor.tar.bz2 runsc containerd-shim-runsc-v1
sudo install -m 0755 runsc containerd-shim-runsc-v1 /usr/local/bin/

# --oci-seccomp makes runsc enforce the seccomp profile Docker passes (the agent sets
# seccomp=builtin, task 33d); without it runsc ignores the profile.
# --overlay2 keeps runsc's default root overlay (backed by a file in the container's rootfs) and
# caps its upper layer at 1 GiB, so a sandbox cannot fill the node's disk (task 33b; the agent's
# TestSandboxRootfsWriteLimitOnRunsc writes past it).
sudo /usr/local/bin/runsc install -- --oci-seccomp --overlay2=root:self,size=1g
sudo systemctl restart docker

if ! docker info --format '{{json .Runtimes}}' | grep -q '"runsc"'; then
  echo "::error::runsc is not registered with Docker"
  exit 1
fi
runsc --version
