# Terraform Variables

variable "gcp_project_id" {
  description = "GCP Project ID (required for GCP deployments)"
  type        = string
  default     = ""
}

variable "model_provider_api_key" {
  description = "Model provider API key (e.g., OpenAI)"
  type        = string
  sensitive   = true
}

variable "operational_bearer_token" {
  description = "Bearer token for operational endpoints"
  type        = string
  sensitive   = true
}

variable "auth_jwt_secret" {
  description = "JWT secret for AI token signing"
  type        = string
  sensitive   = true
}

variable "enable_https" {
  description = "Enable HTTPS with TLS termination"
  type        = bool
  default     = true
}

variable "enable_waf" {
  description = "Enable Web Application Firewall"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 30
}
