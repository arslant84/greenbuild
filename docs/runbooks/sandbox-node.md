# Sandbox node runtime settings

What a sandbox node needs from Docker and gVisor beyond what the agent sets per sandbox. Task 28e turns this into the node's cloud-init; until then CI applies the same settings in `.github/scripts/install-gvisor.sh`, which is the reference.

## runsc

Register runsc with these runtime flags:

```sh
sudo runsc install -- --oci-seccomp --overlay2=root:self,size=1g
```

| Flag | Why |
|---|---|
| `--oci-seccomp` | runsc enforces the seccomp profile Docker passes. The agent sets `seccomp=builtin` on every sandbox (task 33d); without this flag runsc ignores it |
| `--overlay2=root:self,size=1g` | The root overlay's upper layer is capped at 1 GiB, so a sandbox cannot fill the node's disk (task 33b) |

## Docker daemon

Add to `/etc/docker/daemon.json`, next to the `runtimes` entry `runsc install` writes, then restart Docker:

```json
{ "userns-remap": "default" }
```

Root inside a sandbox then runs as an unprivileged host UID from Docker's `dockremap` user's range in `/etc/subuid` (task 33e). Images and containers pulled before the change live under a different directory and are not visible after it, so pull challenge images after enabling it.

## Check

```sh
docker info --format '{{json .Runtimes}}'          # contains "runsc"
docker info --format '{{json .SecurityOptions}}'   # contains "name=userns"
```

The agent's integration tests named `…OnRunsc` check the overlay cap and the user mapping on a node set up this way (`go test -tags integration -run OnRunsc ./...` in `apps/sandbox-agent`, as the gVisor CI job does).
