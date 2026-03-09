# Terraform Outputs

output "deployment_info" {
  description = "Deployment information"
  value = {
    cloud_provider = var.cloud_provider
    environment    = var.environment
    region         = var.region
  }
}

output "health_check_url" {
  description = "Health check URL"
  value       = local.is_aws ? "${module.aws_ai_server[0].endpoint}/healthz" : null
}

output "deployment_commands" {
  description = "Useful commands for deployment"
  value = {
    view_logs   = local.is_aws ? "aws logs tail /ecs/ai-server --follow" : ""
    ssh_access  = local.is_aws ? "aws ecs execute-command --cluster ai-server --task <task-id> --interactive" : ""
  }
}
