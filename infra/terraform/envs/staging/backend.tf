# State lives in the storage account the owner creates by hand (docs/runbooks/terraform-state.md). The
# azurerm backend locks it with a blob lease while a plan or apply runs. Sign-in is Entra ID (OIDC in CI),
# never the account's access keys.
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-greenbuild-tfstate"
    storage_account_name = "greenbuildtfstate"
    container_name       = "tfstate"
    key                  = "staging.tfstate"
    use_oidc             = true
    use_azuread_auth     = true
  }
}
