output "app_identities" {
  description = "The apps' managed identities by app (web, api, worker, engine): id, client_id and principal_id."
  value = {
    for app, identity in azurerm_user_assigned_identity.app : app => {
      id           = identity.id
      client_id    = identity.client_id
      principal_id = identity.principal_id
    }
  }
}

output "key_vault_id" {
  description = "The environment's Key Vault, for the apps' secrets (28d)."
  value       = azurerm_key_vault.environment.id
}

output "storage_account_id" {
  description = "The Blob Storage account of the session logs and export archives (28f)."
  value       = azurerm_storage_account.environment.id
}
