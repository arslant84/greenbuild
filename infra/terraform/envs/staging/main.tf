# The staging environment (architecture.md, «Окружения»). Each module of tasks 28b–28e adds its resources;
# nothing is created until an apply, which runs only with the owner's approval.
provider "azurerm" {
  features {}

  # The CI identity is a Reader and cannot register resource providers; the runbook registers the ones
  # staging needs once, by hand.
  resource_provider_registrations = "none"

  # The subscription, tenant and client come from ARM_* environment variables (OIDC in CI).
}

# Task 28b: the environment's resource group and its two networks. The ranges leave room in each VNet for
# the subnets of later tasks; eastus is the region of the state storage (docs/runbooks/terraform-state.md).
module "network" {
  source = "../../modules/network"

  environment = "staging"
  location    = "eastus"
  address_prefixes = {
    core           = "10.10.0.0/16"
    core_apps      = "10.10.0.0/23"
    core_engine    = "10.10.2.0/27"
    core_endpoints = "10.10.3.0/27"
    sandbox        = "10.20.0.0/16"
    sandbox_nodes  = "10.20.0.0/24"
  }
}

# Task 28c: Blob Storage, Key Vault and the apps' identities, reached only through private endpoints.
module "data" {
  source = "../../modules/data"

  environment         = "staging"
  location            = "eastus"
  resource_group_name = module.network.resource_group_name
  core_vnet_id        = module.network.core_vnet_id
  endpoints_subnet_id = module.network.subnet_ids.endpoints
}
