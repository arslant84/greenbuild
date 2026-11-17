# Azure Managed Redis: the queue (Redis Streams), leaderboards and rate limits (architecture.md, deviation
# 39). Sign-in is Entra only, with each app's managed identity.
resource "azurerm_managed_redis" "environment" {
  name                      = "redis-${local.name}"
  resource_group_name       = var.resource_group_name
  location                  = var.location
  sku_name                  = var.redis_sku_name
  high_availability_enabled = var.redis_high_availability
  public_network_access     = "Disabled"

  default_database {
    access_keys_authentication_enabled = false
    client_protocol                    = "Encrypted"
    # One endpoint for ordinary clients; the apps use no cross-key commands that this policy limits.
    clustering_policy = "EnterpriseCluster"
    # The queue's streams must never be evicted to make room.
    eviction_policy = "NoEviction"
  }
}

# Every app uses Redis: web, api and worker (TypeScript) and the engine (Go).
resource "azurerm_managed_redis_access_policy_assignment" "app" {
  for_each = azurerm_user_assigned_identity.app

  managed_redis_id = azurerm_managed_redis.environment.id
  object_id        = each.value.principal_id
}
