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

variable "apps_subnet_id" {
  description = "Subnet of web, api and worker (network module output subnet_ids.apps)."
  type        = string
}

variable "engine_subnet_id" {
  description = "Subnet of the sandbox engine (network module output subnet_ids.engine)."
  type        = string
}
