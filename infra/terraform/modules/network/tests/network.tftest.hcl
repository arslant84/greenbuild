# Runs against a mock provider: no Azure account, nothing created. The provider checks the format of the
# ids it is given, so the mocks get real-looking ones, distinct per subnet.
mock_provider "azurerm" {
  mock_resource "azurerm_virtual_network" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-test"
    }
  }
  mock_resource "azurerm_network_security_group" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/networkSecurityGroups/nsg-test"
    }
  }
}

override_resource {
  target = azurerm_subnet.container_apps["apps"]
  values = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-test/subnets/apps" }
}

override_resource {
  target = azurerm_subnet.container_apps["engine"]
  values = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-test/subnets/engine" }
}

override_resource {
  target = azurerm_subnet.endpoints
  values = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-test/subnets/endpoints" }
}

override_resource {
  target = azurerm_subnet.nodes
  values = { id = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-test/subnets/nodes" }
}

variables {
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

run "sandbox_nodes_accept_only_the_engine_on_the_agent_port" {
  command = apply

  assert {
    condition = [
      for rule in azurerm_network_security_group.sandbox_nodes.security_rule :
      [rule.direction, rule.protocol, rule.source_address_prefix, rule.destination_port_range]
      if rule.access == "Allow"
    ] == [["Inbound", "Tcp", "10.10.2.0/27", "9443"]]
    error_message = "the only allowed traffic must be TCP 9443 into the nodes from the engine subnet"
  }

  assert {
    condition = anytrue([
      for rule in azurerm_network_security_group.sandbox_nodes.security_rule :
      rule.direction == "Inbound" && rule.access == "Deny" && rule.source_address_prefix == "*" && rule.destination_port_range == "*" && rule.protocol == "*"
    ])
    error_message = "the nodes must deny every other inbound connection"
  }

  assert {
    condition     = azurerm_subnet_network_security_group_association.sandbox_nodes.subnet_id == azurerm_subnet.nodes.id
    error_message = "the sandbox NSG must be attached to the nodes subnet"
  }
}

run "sandbox_nodes_send_nothing_out" {
  command = apply

  assert {
    condition = anytrue([
      for rule in azurerm_network_security_group.sandbox_nodes.security_rule :
      rule.direction == "Outbound" && rule.access == "Deny" && rule.destination_address_prefix == "*" && rule.destination_port_range == "*" && rule.protocol == "*"
    ])
    error_message = "the nodes must deny all outbound traffic"
  }
}

run "core_subnets_refuse_the_sandbox" {
  command = apply

  assert {
    condition = [
      for rule in azurerm_network_security_group.core.security_rule :
      [rule.direction, rule.access, rule.source_address_prefix, rule.destination_port_range]
    ] == [["Inbound", "Deny", "10.20.0.0/16", "*"]]
    error_message = "the core NSG must deny all inbound traffic from the sandbox VNet, and only that"
  }

  assert {
    condition = (
      azurerm_subnet_network_security_group_association.core["apps"].subnet_id == azurerm_subnet.container_apps["apps"].id &&
      azurerm_subnet_network_security_group_association.core["engine"].subnet_id == azurerm_subnet.container_apps["engine"].id &&
      azurerm_subnet_network_security_group_association.core["endpoints"].subnet_id == azurerm_subnet.endpoints.id
    )
    error_message = "the core NSG must be attached to the apps, engine and endpoints subnets"
  }

  assert {
    condition     = azurerm_subnet.endpoints.private_endpoint_network_policies == "Enabled"
    error_message = "NSG rules must apply to the private endpoints"
  }
}

run "nothing_gets_a_public_ip_or_a_forwarded_route" {
  command = apply

  assert {
    condition     = !azurerm_subnet.nodes.default_outbound_access_enabled && !azurerm_subnet.endpoints.default_outbound_access_enabled
    error_message = "the nodes and endpoints subnets must give no implicit public IP"
  }

  assert {
    condition = alltrue([
      for peering in values(azurerm_virtual_network_peering.between) :
      !peering.allow_forwarded_traffic && !peering.allow_gateway_transit && !peering.use_remote_gateways
    ])
    error_message = "the peering must not forward or transit traffic"
  }
}
