# The environment's container platform (architecture.md, «Окружения», task 28d): the image registry, the
# log workspace and two Container Apps environments, one per subnet of VNet core. The apps themselves
# come in 28d-2.
locals {
  name = "greenbuild-${var.environment}"
  # Registries allow no hyphens (modules/README.md, «Names»).
  registry_name = "crgreenbuild${var.environment}"

  # web, api and worker share one environment; the engine has its own, in the subnet the sandbox NSG
  # accepts (network module).
  container_app_environments = {
    apps   = var.apps_subnet_id
    engine = var.engine_subnet_id
  }

  log_retention_days = 30
  # Caps the log bill: past this a day's logs are dropped.
  log_daily_quota_gb = 1
}

# Basic has no private endpoint; images are pulled with the apps' managed identities, never a password.
resource "azurerm_container_registry" "environment" {
  name                   = local.registry_name
  resource_group_name    = var.resource_group_name
  location               = var.location
  sku                    = "Basic"
  admin_enabled          = false
  anonymous_pull_enabled = false
}

resource "azurerm_log_analytics_workspace" "environment" {
  name                = "log-${local.name}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = local.log_retention_days
  daily_quota_gb      = local.log_daily_quota_gb
}

resource "azurerm_container_app_environment" "environment" {
  for_each = local.container_app_environments

  name                       = "cae-${local.name}-${each.key}"
  resource_group_name        = var.resource_group_name
  location                   = var.location
  infrastructure_subnet_id   = each.value
  logs_destination           = "log-analytics"
  log_analytics_workspace_id = azurerm_log_analytics_workspace.environment.id

  # Workload profiles fit the engine's /27 subnet; Consumption bills only what runs.
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}
