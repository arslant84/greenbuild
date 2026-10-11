# Sandbox escape and abuse checklist

What a player's sandbox must refuse, what refuses it, and which check proves it. Automated checks run in the agent's integration tests: `-run OnRealDocker` under `SANDBOX_TEST_RUNTIME` (runc locally, runsc in the gVisor CI job) and `-run OnRunsc` only in that job. Task 34b is the owner's manual pass of this list in staging, recorded in `docs/progress.md`.

Every sandbox gets the same isolation from the agent (`apps/sandbox-agent/internal/sandbox/spec.go`): network `none`, all capabilities dropped except a manifest allowlist, `no-new-privileges`, Docker's default seccomp profile (`seccomp=builtin`), CPU and memory limits with no swap, 256 processes, 8192 open files, and a TTL the agent enforces on its own. Node runtime settings are in `docs/runbooks/sandbox-node.md`.

## Automated probes

`TestSandboxRefusesEscapeProbesOnRealDocker` (`escape_integration_test.go`) runs each probe in a fresh sandbox. A probe is a shell script that exits 0 only if the attack worked.

| Probe | Script | Refused by |
|---|---|---|
| Outbound network | `wget -T 3 http://1.1.1.1` | Network `none`: only loopback exists |
| Mount a filesystem | `mount -t tmpfs none /mnt` | No `CAP_SYS_ADMIN`; seccomp |
| Read kernel memory | read 16 bytes of `/proc/kcore` | Docker masks it with `/dev/null`; under gVisor `/proc` is the sentry's own, not the host's |
| Reach the Docker socket | `test -S /var/run/docker.sock` | Nothing is mounted from the host |
| Open a raw socket | `arping -I lo 127.0.0.1` (`AF_PACKET`) | No `CAP_NET_RAW` |
| Fork bomb | start 300 processes | PID limit 256 |
| Exhaust memory | buffer 200 MiB in a 64 MiB sandbox | Memory limit with no swap: the process is OOM-killed |

## Covered by other tests

| Attack | Refused by | Test |
|---|---|---|
| Create a user namespace (a step in many kernel exploits) | Default seccomp profile | `TestSandboxSeccompRefusesUserNamespaceOnRealDocker` (33d) |
| Fill the node's disk | runsc root overlay capped at 1 GiB | `TestSandboxRootfsWriteLimitOnRunsc` (33b, gVisor only) |
| Root in the sandbox is root on the host | Docker `userns-remap` | `TestSandboxRootIsUnprivilegedOnHostOnRunsc` (33e, gVisor only) |
| Mining (95% or more of the CPU limit for 60 s) | The agent's CPU watch destroys the sandbox; the API fails and flags the attempt | `TestCPUWatchDestroysABusySandboxOnRealDocker` (33f) |
| Exhaust file descriptors | `nofile` 8192, not raisable | `TestSandboxOpenFileLimitOnRealDocker` (33a) |
| Keep a sandbox past its time | The agent destroys it after TTL + 2 minutes without outside commands | `TestSandboxDisappearsAfterTTLWithoutCommandsOnRealDocker` (task 4) |

## Manual checks in staging (task 34b)

These need the real network and nodes, which only staging has (tasks 28a–28h).

- From a sandbox, the Azure instance metadata endpoint `169.254.169.254` does not answer.
- From a sandbox node, PostgreSQL, Redis and the API are unreachable; the agent's gRPC port accepts only the control plane (NSG).
- The agent refuses gRPC without the control plane's client certificate.
- `docker info` on a node shows `runsc` with `--oci-seccomp` and the overlay cap, and `name=userns`.
- Every automated probe above, run by hand from a sandbox started through the real product path.

## Status

- Locally (runc, Docker 29.7.2): all seven probes refused. The probes can tell a weak sandbox from a strong one: without a PID limit the fork probe exits 0 (301 processes), and with `seccomp=unconfined` the user namespace check succeeds.
- Under gVisor: not run yet. The gVisor CI job runs the same test once GitHub Actions can run.
