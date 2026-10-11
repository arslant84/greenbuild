# ADR-005: gVisor isolates sandboxes in the MVP

Status: Proposed (task 38, awaiting the owner's approval)

## Context

Players get a root shell in a container. A plain runc container shares the host kernel, so a kernel bug becomes a host escape. Full VMs per attempt start too slowly for a daily game (gate: p95 start under 20 s).

## Decision

- Sandboxes run under gVisor (`runsc`) on VMs in the MVP; Kata Containers through AKS Pod Sandboxing when load grows.
- On top of the runtime: network `none`, CPU, memory and PID limits, open-file limit, all capabilities dropped except those the manifest names, `no-new-privileges`, a hard TTL enforced by the agent, and a CPU-abuse kill. Read-only root, disk limit, seccomp and user namespaces follow in tasks 33b–33e.
- Local development uses runc; a CI job runs the integration tests under gVisor, with its version pinned there and updated by a separate PR.

## Consequences

- A user-space kernel between the player and the host kernel at a cost of slower syscalls, which the challenges tolerate.
- Some challenges cannot work under gVisor's syscall surface and must be designed around it; `verify-challenge.sh` checks each challenge under the runtime.
- While GitHub Actions cannot run (owner, 2026-10-08), gVisor behaviour is not verified on new changes.
