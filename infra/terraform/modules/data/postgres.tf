# PostgreSQL 16 (architecture.md, «Технологический стек»). Sign-in is Entra only: the apps use their managed
# identities and no password exists (owner, 2026-11-17).
locals {
  # The database the apps and migrations use, as in the local stack (scripts/play-stack.sh).
  database_name = "greenbuild"
}

# Runs the migrations and creates the apps' database roles (28g), so it is the server's Entra admin.
resource "azurerm_user_assigned_identity" "migrate" {
  name                = "id-${local.name}-migrate"
  resource_group_name = var.resource_group_name
  location            = var.location
}

resource "azurerm_postgresql_flexible_server" "environment" {
  name                          = "psql-${local.name}"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = "16"
  sku_name                      = var.postgres_sku_name
  storage_mb                    = 32768
  backup_retention_days         = 7
  public_network_access_enabled = false

  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
    tenant_id                     = data.azurerm_client_config.current.tenant_id
  }

  # Azure picks a zone at creation; a later plan must not try to move the server.
  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_active_directory_administrator" "migrate" {
  server_name         = azurerm_postgresql_flexible_server.environment.name
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = azurerm_user_assigned_identity.migrate.principal_id
  principal_name      = azurerm_user_assigned_identity.migrate.name
  principal_type      = "ServicePrincipal"
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = local.database_name
  server_id = azurerm_postgresql_flexible_server.environment.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}
