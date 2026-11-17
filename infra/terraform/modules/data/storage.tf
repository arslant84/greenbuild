locals {
  # Container names are the apps' constants: apps/sandbox-engine/internal/sessionlog/blob.go (Container) and
  # packages/shared/src/api/me.ts (EXPORTS_BLOB_CONTAINER).
  sessions_container = "sessions"
  blob_containers    = [local.sessions_container, "privacy-exports"]

  # architecture.md, «Политика хранения данных»: session logs are kept 90 days.
  session_log_retention_days = 90
}

resource "azurerm_storage_account" "environment" {
  name                     = local.storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_kind             = "StorageV2"
  account_tier             = "Standard"
  account_replication_type = local.storage_replication
  access_tier              = "Hot"

  https_traffic_only_enabled       = true
  min_tls_version                  = "TLS1_2"
  public_network_access            = "Disabled"
  allow_nested_items_to_be_public  = false
  shared_access_key_enabled        = false
  default_to_oauth_authentication  = true
  cross_tenant_replication_enabled = false
}

resource "azurerm_storage_container" "app" {
  for_each = toset(local.blob_containers)

  name                  = each.key
  storage_account_id    = azurerm_storage_account.environment.id
  container_access_type = "private"
}

# The engine writes each session log as an append blob (task 49a). Azure can only delete append blobs by
# rule, not move them to Cool, so the logs stay Hot until they go (architecture.md, deviation 38).
resource "azurerm_storage_management_policy" "environment" {
  storage_account_id = azurerm_storage_account.environment.id

  rule {
    name    = "delete-session-logs"
    enabled = true

    filters {
      blob_types   = ["appendBlob"]
      prefix_match = ["${local.sessions_container}/"]
    }

    actions {
      base_blob {
        delete_after_days_since_creation_greater_than = local.session_log_retention_days
      }
    }
  }
}
