# Pinned so a Terraform or provider release cannot change a plan without a PR; .terraform.lock.hcl pins the
# exact provider build. CI's Terraform job installs the same Terraform version (.github/workflows/ci.yml).
terraform {
  required_version = "~> 1.16.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.9.0"
    }
  }
}
