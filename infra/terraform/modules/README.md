# Terraform modules

Reusable modules that `envs/*` call. Each comes with its task in `docs/architecture.md` (block Г) and its own `terraform test`.

| Module | Task | What it creates |
|---|---|---|
| `network` | 28b | VNet `core` and VNet `sandbox`, their subnets and NSGs. The sandbox NSG allows inbound traffic only from the control plane subnet, on the agent's gRPC port, and denies outbound traffic |
| `data` | 28c | PostgreSQL Flexible Server (private access), Redis, Key Vault, a Storage account with the `sessions` container and its lifecycle rule (Cool after 30 days, deleted after 90), managed identities |
| `apps` | 28d | ACR, the Container Apps environment, and the web, api, worker and engine apps, each with a managed identity and secrets from Key Vault |
| `sandbox-node` | 28e | The sandbox node VM. Its cloud-init installs Docker, gVisor at the version CI pins, the agent as a systemd service, and mTLS certificates from Key Vault |

Private company challenges never reach this public repository or its CI (`docs/architecture.md`, deviation 29). Their sources, images, build logs and verification runs live elsewhere, chosen in Stage 1.5. Task 28c may add only an empty private Blob container and a `private/` namespace in ACR for them, if that is cheap.
