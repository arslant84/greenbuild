# The environment's data services (architecture.md, «Окружения», task 28c): Key Vault here, Blob Storage,
# PostgreSQL and Redis in their own files. Nothing has a public endpoint: the apps reach each service
# through a private endpoint in VNet core (endpoints.tf).
locals {
  name = "greenbuild-${var.environment}"
  # Storage accounts allow no hyphens (modules/README.md, «Names»).
  storage_account_name = "stgreenbuild${var.environment}"
  # Prod keeps a copy in every zone of the region; staging can lose its data.
  storage_replication = var.environment == "prod" ? "ZRS" : "LRS"

  # Each app of task 28d signs in to the data services with its own identity, never with keys.
  apps = ["web", "api", "worker", "engine"]
}

data "azurerm_client_config" "current" {}

resource "azurerm_user_assigned_identity" "app" {
  for_each = toset(local.apps)

  name                = "id-${local.name}-${each.key}"
  resource_group_name = var.resource_group_name
  location            = var.location
}

# Secrets for the apps (28d). Access is by Azure RBAC role, not access policies.
resource "azurerm_key_vault" "environment" {
  name                          = "kv-${local.name}"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  public_network_access_enabled = false
  # Purge protection keeps a deleted vault's name taken for 90 days; staging must be able to be torn
  # down and created again.
  purge_protection_enabled = var.environment == "prod"

  network_acls {
    default_action = "Deny"
    bypass         = "None"
  }
}
