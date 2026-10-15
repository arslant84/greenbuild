# The staging environment (architecture.md, «Окружения»). Resources arrive with the modules of tasks
# 28b–28e; until then a plan has nothing to change.
provider "azurerm" {
  features {}

  # The CI identity is a Reader and cannot register resource providers; the runbook registers the ones
  # staging needs once, by hand.
  resource_provider_registrations = "none"

  # The subscription, tenant and client come from ARM_* environment variables (OIDC in CI).
}
