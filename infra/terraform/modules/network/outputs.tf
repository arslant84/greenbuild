output "resource_group_name" {
  description = "The environment's resource group, for the modules of 28c–28e."
  value       = azurerm_resource_group.environment.name
}

output "subnet_ids" {
  description = "Subnet ids by role: apps, engine, endpoints, nodes."
  value = {
    apps      = azurerm_subnet.container_apps["apps"].id
    engine    = azurerm_subnet.container_apps["engine"].id
    endpoints = azurerm_subnet.endpoints.id
    nodes     = azurerm_subnet.nodes.id
  }
}
