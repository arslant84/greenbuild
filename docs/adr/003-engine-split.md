# ADR-003: The sandbox engine is split into a control plane and node agents

Status: Accepted (owner, 2026-10-12)

## Context

Sandboxes run code from players, which must be treated as hostile. The component that starts containers needs Docker access on the node; the component that reads the queue, proxies terminals and runs checks needs Redis, Blob Storage and the internal API.

## Decision

- `apps/sandbox-engine` (control plane) lives in the application network. It reads `sandbox.create`, picks the node, proxies the terminal WebSocket (`/attach`), runs checks (`POST /internal/attempts/{id}/check`) and writes session logs.
- `apps/sandbox-agent` runs on each sandbox node in an isolated network. It accepts only inbound gRPC over mTLS 1.3 from the control plane (`CreateSandbox`, `Exec`, `CopyIn`, `Run`, `Destroy`, `Health`) and has no route to the database, Redis or the API.
- The agent destroys sandboxes on its own when their TTL passes, even without the control plane.
- The API never controls containers; it only puts jobs on the queue.

## Consequences

- An escape from a sandbox lands on a node that holds no data and cannot reach any.
- Every container operation crosses a mutually authenticated channel; dev certificates come from `packages/devpki`.
- Two Go programs share some code by copy until a third Go service appears (open item in `architecture.md`).
