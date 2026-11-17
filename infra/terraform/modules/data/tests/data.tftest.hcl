# Runs against a mock provider: no Azure account, nothing created. The provider checks the format of the
# ids it is given, so the mocks get real-looking ones.
mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = {
      tenant_id = "00000000-0000-0000-0000-000000000001"
    }
  }
  mock_resource "azurerm_storage_account" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Storage/storageAccounts/sttest"
    }
  }
  mock_resource "azurerm_key_vault" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.KeyVault/vaults/kv-test"
    }
  }
  mock_resource "azurerm_private_dns_zone" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/privateDnsZones/privatelink.test"
    }
  }
}

variables {
  environment         = "staging"
  resource_group_name = "rg-greenbuild-staging"
  location            = "eastus"
  core_vnet_id        = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-core"
  endpoints_subnet_id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-core/subnets/endpoints"
}

run "session_logs_are_deleted_after_90_days" {
  command = apply

  assert {
    condition = [
      for rule in azurerm_storage_management_policy.environment.rule : [
        rule.enabled,
        rule.filters[0].blob_types,
        rule.filters[0].prefix_match,
        rule.actions[0].base_blob[0].delete_after_days_since_creation_greater_than,
      ]
    ] == [[true, toset(["appendBlob"]), toset(["sessions/"]), 90]]
    error_message = "the only rule must delete the sessions container's append blobs 90 days after creation"
  }
}

run "nothing_is_reachable_from_the_internet" {
  command = apply

  assert {
    condition = (
      azurerm_storage_account.environment.public_network_access == "Disabled" &&
      !azurerm_storage_account.environment.allow_nested_items_to_be_public &&
      !azurerm_storage_account.environment.shared_access_key_enabled
    )
    error_message = "the storage account must have no public network access, no public blobs and no access keys"
  }

  assert {
    condition = alltrue([
      for container in values(azurerm_storage_container.app) : container.container_access_type == "private"
    ])
    error_message = "every container must be private"
  }

  assert {
    condition = (
      !azurerm_key_vault.environment.public_network_access_enabled &&
      azurerm_key_vault.environment.network_acls[0].default_action == "Deny" &&
      azurerm_key_vault.environment.rbac_authorization_enabled
    )
    error_message = "the Key Vault must have no public network access and use RBAC"
  }
}

run "the_apps_reach_blob_and_key_vault_through_private_endpoints" {
  command = apply

  assert {
    condition = sort(keys(azurerm_private_endpoint.service)) == tolist(["blob", "vault"]) && alltrue([
      for key, endpoint in azurerm_private_endpoint.service :
      endpoint.subnet_id == var.endpoints_subnet_id && endpoint.private_service_connection[0].subresource_names == tolist([key])
    ])
    error_message = "Blob and Key Vault must each have a private endpoint in the endpoints subnet"
  }

  assert {
    condition = alltrue([
      for link in values(azurerm_private_dns_zone_virtual_network_link.core) : link.virtual_network_id == var.core_vnet_id
    ])
    error_message = "the private DNS zones must resolve in VNet core"
  }
}

run "each_app_has_its_own_identity" {
  command = apply

  assert {
    condition     = sort(keys(azurerm_user_assigned_identity.app)) == tolist(["api", "engine", "web", "worker"])
    error_message = "web, api, worker and engine must each have a managed identity"
  }
}
