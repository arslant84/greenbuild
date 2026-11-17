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

# Sizes are chosen by the owner when approving the apply (architecture.md, deviation 39); the defaults are
# the smallest that run the app.
variable "postgres_sku_name" {
  description = "PostgreSQL Flexible Server compute, e.g. B_Standard_B1ms or B_Standard_B2s."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "redis_sku_name" {
  description = "Azure Managed Redis size, e.g. Balanced_B0."
  type        = string
  default     = "Balanced_B0"
}

variable "redis_high_availability" {
  description = "Whether Redis keeps a replica (high availability), at a higher price."
  type        = bool
  default     = false
}
