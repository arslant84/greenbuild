# Private endpoints in VNet core's endpoints subnet, and the private DNS zones that make the services'
# usual names resolve to them from inside VNet core. Subresources and zones: Microsoft's «Azure Private
# Endpoint private DNS zone values».
locals {
  private_endpoints = {
    blob = {
      resource_id = azurerm_storage_account.environment.id
      subresource = "blob"
      dns_zone    = "privatelink.blob.core.windows.net"
    }
    vault = {
      resource_id = azurerm_key_vault.environment.id
      subresource = "vault"
      dns_zone    = "privatelink.vaultcore.azure.net"
    }
    postgres = {
      resource_id = azurerm_postgresql_flexible_server.environment.id
      subresource = "postgresqlServer"
      dns_zone    = "privatelink.postgres.database.azure.com"
    }
    redis = {
      resource_id = azurerm_managed_redis.environment.id
      subresource = "redisEnterprise"
      dns_zone    = "privatelink.redis.azure.net"
    }
  }
}

resource "azurerm_private_dns_zone" "service" {
  for_each = local.private_endpoints

  name                = each.value.dns_zone
  resource_group_name = var.resource_group_name
}

resource "azurerm_private_dns_zone_virtual_network_link" "core" {
  for_each = local.private_endpoints

  name                 = "link-${local.name}-core-${each.key}"
  private_dns_zone_id  = azurerm_private_dns_zone.service[each.key].id
  virtual_network_id   = var.core_vnet_id
  registration_enabled = false
}

resource "azurerm_private_endpoint" "service" {
  for_each = local.private_endpoints

  name                = "pe-${local.name}-${each.key}"
  resource_group_name = var.resource_group_name
  location            = var.location
  subnet_id           = var.endpoints_subnet_id

  private_service_connection {
    name                           = "psc-${local.name}-${each.key}"
    private_connection_resource_id = each.value.resource_id
    subresource_names              = [each.value.subresource]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.service[each.key].id]
  }
}
