# Runs against a mock provider: no Azure account, nothing created. The provider checks the format of the
# ids it is given, so the mocks get real-looking ones.
mock_provider "azurerm" {
  mock_resource "azurerm_log_analytics_workspace" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.OperationalInsights/workspaces/log-test"
    }
  }
}

variables {
  environment         = "staging"
  resource_group_name = "rg-greenbuild-staging"
  location            = "eastus"
  apps_subnet_id      = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-core/subnets/apps"
  engine_subnet_id    = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-core/subnets/engine"
}

run "the_registry_takes_no_password_and_no_anonymous_pulls" {
  command = apply

  assert {
    condition     = !azurerm_container_registry.environment.admin_enabled && !azurerm_container_registry.environment.anonymous_pull_enabled
    error_message = "the registry must have no admin password and no anonymous pull"
  }
}

run "web_api_worker_and_the_engine_run_in_their_own_subnets" {
  command = apply

  assert {
    condition = (
      azurerm_container_app_environment.environment["apps"].infrastructure_subnet_id == var.apps_subnet_id &&
      azurerm_container_app_environment.environment["engine"].infrastructure_subnet_id == var.engine_subnet_id
    )
    error_message = "the apps environment must use the apps subnet and the engine environment the engine subnet"
  }

  assert {
    condition = alltrue([
      for environment in values(azurerm_container_app_environment.environment) :
      length(environment.workload_profile) == 1 && alltrue([for profile in environment.workload_profile : profile.workload_profile_type == "Consumption"])
    ])
    error_message = "each environment must run on the Consumption workload profile only"
  }
}

run "logs_have_a_daily_cap" {
  command = apply

  assert {
    condition     = azurerm_log_analytics_workspace.environment.daily_quota_gb == 1
    error_message = "the log workspace must cap ingestion at 1 GB a day"
  }
}
