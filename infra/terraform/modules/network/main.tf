# The environment's resource group and networks (architecture.md, «Сети», task 28b). VNet core holds the
# apps and the data's private endpoints; VNet sandbox holds only the sandbox nodes. The two are peered so
# the engine can reach the agents; NSGs on both sides keep the sandbox away from everything else.
locals {
  name = "greenbuild-${var.environment}"

  # Container Apps environments need a subnet delegated to them.
  container_apps_subnets = {
    apps   = var.address_prefixes.core_apps
    engine = var.address_prefixes.core_engine
  }
}

resource "azurerm_resource_group" "environment" {
  name     = "rg-${local.name}"
  location = var.location
}

resource "azurerm_virtual_network" "core" {
  name                = "vnet-${local.name}-core"
  resource_group_name = azurerm_resource_group.environment.name
  location            = azurerm_resource_group.environment.location
  address_space       = [var.address_prefixes.core]
}

resource "azurerm_virtual_network" "sandbox" {
  name                = "vnet-${local.name}-sandbox"
  resource_group_name = azurerm_resource_group.environment.name
  location            = azurerm_resource_group.environment.location
  address_space       = [var.address_prefixes.sandbox]
}

resource "azurerm_subnet" "container_apps" {
  for_each = local.container_apps_subnets

  name                 = "snet-${local.name}-core-${each.key}"
  resource_group_name  = azurerm_resource_group.environment.name
  virtual_network_name = azurerm_virtual_network.core.name
  address_prefixes     = [each.value]

  delegation {
    name = "container-apps"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "endpoints" {
  name                 = "snet-${local.name}-core-endpoints"
  resource_group_name  = azurerm_resource_group.environment.name
  virtual_network_name = azurerm_virtual_network.core.name
  address_prefixes     = [var.address_prefixes.core_endpoints]
  # Without it, NSG rules do not apply to private endpoints.
  private_endpoint_network_policies = "Enabled"
  # No implicit public IP for anything in the subnet.
  default_outbound_access_enabled = false
}

resource "azurerm_subnet" "nodes" {
  name                            = "snet-${local.name}-sandbox-nodes"
  resource_group_name             = azurerm_resource_group.environment.name
  virtual_network_name            = azurerm_virtual_network.sandbox.name
  address_prefixes                = [var.address_prefixes.sandbox_nodes]
  default_outbound_access_enabled = false
}

# Peering in both directions, so the engine can open connections to the agents. Nothing is forwarded or
# transited; what may cross is decided by the NSGs (security.tf).
resource "azurerm_virtual_network_peering" "between" {
  for_each = {
    core-to-sandbox = { from = azurerm_virtual_network.core, to = azurerm_virtual_network.sandbox }
    sandbox-to-core = { from = azurerm_virtual_network.sandbox, to = azurerm_virtual_network.core }
  }

  name                         = "peer-${local.name}-${each.key}"
  resource_group_name          = azurerm_resource_group.environment.name
  virtual_network_name         = each.value.from.name
  remote_virtual_network_id    = each.value.to.id
  allow_virtual_network_access = true
  allow_forwarded_traffic      = false
  allow_gateway_transit        = false
  use_remote_gateways          = false
}
