variable "environment" {
  description = "Environment name in resource names: staging or prod."
  type        = string

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "environment: must be staging or prod."
  }
}

variable "location" {
  description = "Azure region for the environment's resource group and networks, e.g. eastus2."
  type        = string
}

variable "address_prefixes" {
  description = "CIDR ranges: the two VNets and their subnets. Each subnet must sit inside its VNet."
  type = object({
    core           = string # VNet core
    core_apps      = string # Container Apps environment of web, api and worker
    core_engine    = string # the sandbox engine (control plane), alone so the sandbox NSG can name it
    core_endpoints = string # private endpoints of PostgreSQL, Redis, Key Vault and Storage
    sandbox        = string # VNet sandbox
    sandbox_nodes  = string # sandbox nodes running the agent
  })

  validation {
    condition = alltrue([
      for prefix in values(var.address_prefixes) : can(cidrhost(prefix, 0))
    ])
    error_message = "address_prefixes: every value must be a CIDR range such as 10.10.0.0/16."
  }
}

variable "agent_grpc_port" {
  description = "Port the sandbox agent serves gRPC on (apps/sandbox-agent/internal/config/config.go)."
  type        = number
  default     = 9443
}
