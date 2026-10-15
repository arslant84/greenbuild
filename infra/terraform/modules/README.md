# Terraform modules

Reusable modules that `envs/*` call. Each comes with its task in `docs/architecture.md` (block Г) and its own `terraform test`.

| Module | Task | What it creates |
|---|---|---|
| `network` | 28b | The environment's resource group; VNet `core` (subnets `apps` and `engine` for Container Apps, `endpoints` for the data's private endpoints) and VNet `sandbox` (subnet `nodes`), peered without forwarding. The sandbox NSG allows inbound only from `engine`, on the agent's gRPC port, and denies everything else in and out. The core NSG on all three core subnets denies inbound from the sandbox VNet. No public IPs |
| `data` | 28c | PostgreSQL Flexible Server (private access), Redis, Key Vault, a Storage account with the `sessions` container and its lifecycle rule (Cool after 30 days, deleted after 90), managed identities |
| `apps` | 28d | ACR, the Container Apps environment, and the web, api, worker and engine apps, each with a managed identity and secrets from Key Vault |
| `sandbox-node` | 28e | The sandbox node VM. Its cloud-init installs Docker, gVisor at the version CI pins, the agent as a systemd service, and mTLS certificates from Key Vault |

## Names

Every resource is `<type>-greenbuild-<environment>-<name>`, where `<type>` is the Azure abbreviation and `<name>` is left out when the environment has one of that type:

| Type | Example |
|---|---|
| `rg` resource group | `rg-greenbuild-staging` |
| `vnet` virtual network | `vnet-greenbuild-staging-core` |
| `snet` subnet | `snet-greenbuild-staging-core-engine` (VNet, then role) |
| `nsg` network security group | `nsg-greenbuild-staging-sandbox-nodes` |
| `peer` VNet peering | `peer-greenbuild-staging-core-to-sandbox` |

Resources whose names allow no hyphens (storage accounts, ACR) use the same parts without them, e.g. `stgreenbuildstaging`. The state's own resources (`rg-greenbuild-tfstate`, `greenbuildtfstate`) are created by hand and outside this scheme (`docs/runbooks/terraform-state.md`).

## Private challenges

Private company challenges never reach this public repository or its CI (`docs/architecture.md`, deviation 29). Their sources, images, build logs and verification runs live elsewhere, chosen in Stage 1.5. Task 28c may add only an empty private Blob container and a `private/` namespace in ACR for them, if that is cheap.
