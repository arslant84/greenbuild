# Network security groups. NSGs are stateful: replies to an allowed connection pass in both directions,
# so "outbound denied" still lets the agent answer the engine.

# Sandbox nodes: only the engine reaches the agent's gRPC port; nothing else comes in or goes out.
resource "azurerm_network_security_group" "sandbox_nodes" {
  name                = "nsg-${local.name}-sandbox-nodes"
  resource_group_name = azurerm_resource_group.environment.name
  location            = azurerm_resource_group.environment.location

  security_rule {
    name                       = "allow-agent-grpc-from-engine"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = var.address_prefixes.core_engine
    source_port_range          = "*"
    destination_address_prefix = var.address_prefixes.sandbox_nodes
    destination_port_range     = tostring(var.agent_grpc_port)
  }

  # Overrides Azure's default rules, which allow inbound from the VNet (peered ones too) and the load
  # balancer, and outbound to the VNet and the internet.
  security_rule {
    name                       = "deny-all-inbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_address_prefix      = "*"
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "*"
  }

  security_rule {
    name                       = "deny-all-outbound"
    priority                   = 4096
    direction                  = "Outbound"
    access                     = "Deny"
    protocol                   = "*"
    source_address_prefix      = "*"
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "sandbox_nodes" {
  subnet_id                 = azurerm_subnet.nodes.id
  network_security_group_id = azurerm_network_security_group.sandbox_nodes.id
}

# Core: nothing from the sandbox VNet reaches the apps, the engine or the data, even if the sandbox NSG
# were wrong. Replies to the engine's own connections still pass, as NSGs are stateful.
resource "azurerm_network_security_group" "core" {
  name                = "nsg-${local.name}-core"
  resource_group_name = azurerm_resource_group.environment.name
  location            = azurerm_resource_group.environment.location

  security_rule {
    name                       = "deny-inbound-from-sandbox"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_address_prefix      = var.address_prefixes.sandbox
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "core" {
  for_each = {
    apps      = azurerm_subnet.container_apps["apps"].id
    engine    = azurerm_subnet.container_apps["engine"].id
    endpoints = azurerm_subnet.endpoints.id
  }

  subnet_id                 = each.value
  network_security_group_id = azurerm_network_security_group.core.id
}
