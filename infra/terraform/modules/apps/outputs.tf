output "registry_id" {
  description = "The image registry, for the apps' pull role (28d-2) and the deploy pipeline (28g)."
  value       = azurerm_container_registry.environment.id
}

output "registry_login_server" {
  description = "The registry's host name, e.g. crgreenbuildstaging.azurecr.io."
  value       = azurerm_container_registry.environment.login_server
}

output "container_app_environment_ids" {
  description = "Container Apps environments by role: apps (web, api, worker) and engine."
  value       = { for role, environment in azurerm_container_app_environment.environment : role => environment.id }
}
