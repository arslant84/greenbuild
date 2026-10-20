# The staging environment (architecture.md, «Окружения»): a minimal copy of prod with seeded data.
provider "azurerm" {
  features {}

  # The CI identity is a Reader and cannot register resource providers; the runbook registers the ones
  # staging needs once, by hand.
  resource_provider_registrations = "none"

  # The subscription, tenant and client come from ARM_* environment variables (OIDC in CI).
}

module "network" {
  source = "../../modules/network"

  environment = "staging"
  location    = "eastus2"
  address_prefixes = {
    core           = "10.10.0.0/16"
    core_apps      = "10.10.0.0/23"
    core_engine    = "10.10.2.0/27"
    core_endpoints = "10.10.3.0/27"
    sandbox        = "10.20.0.0/16"
    sandbox_nodes  = "10.20.0.0/24"
  }
}
