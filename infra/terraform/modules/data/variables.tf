variable "environment" {
  description = "Environment name in resource names: staging or prod."
  type        = string

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "environment: must be staging or prod."
  }
}

variable "resource_group_name" {
  description = "The environment's resource group (network module output)."
  type        = string
}

variable "location" {
  description = "Azure region, the same as the resource group's."
  type        = string
}

variable "core_vnet_id" {
  description = "VNet core, which resolves the private endpoints' names (network module output)."
  type        = string
}

variable "endpoints_subnet_id" {
  description = "Subnet for the private endpoints (network module output subnet_ids.endpoints)."
  type        = string
}
