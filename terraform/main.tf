# AI Server Terraform Configuration
# Multi-cloud deployment for AWS, Azure, and GCP

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "ai-server-terraform-state"
    key    = "ai-server/terraform.tfstate"
    region = "us-east-1"
  }
}

# Variables
variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "cloud_provider" {
  description = "Cloud provider (aws, azure, gcp)"
  type        = string
  default     = "aws"
}

variable "region" {
  description = "Cloud region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "container_image" {
  description = "AI Server container image"
  type        = string
  default     = "ai-server:latest"
}

variable "replicas" {
  description = "Number of AI Server replicas"
  type        = number
  default     = 2
}

# AWS Provider
provider "aws" {
  region = var.region
  
  default_tags {
    tags = {
      Project     = "ai-server"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Azure Provider
provider "azurerm" {
  features {}
}

# GCP Provider
provider "google" {
  project = var.gcp_project_id
  region  = var.region
}

# Local values
locals {
  common_tags = {
    Project     = "ai-server"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  
  is_aws   = var.cloud_provider == "aws"
  is_azure = var.cloud_provider == "azure"
  is_gcp   = var.cloud_provider == "gcp"
}

# AWS Resources
module "aws_networking" {
  count  = local.is_aws ? 1 : 0
  source = "./modules/networking"
  
  providers = {
    aws = aws
  }
  
  vpc_cidr     = var.vpc_cidr
  environment  = var.environment
}

module "aws_redis" {
  count  = local.is_aws ? 1 : 0
  source = "./modules/redis"
  
  providers = {
    aws = aws
  }
  
  subnet_ids    = module.aws_networking[0].private_subnet_ids
  environment   = var.environment
}

module "aws_ai_server" {
  count  = local.is_aws ? 1 : 0
  source = "./modules/ai-server"
  
  providers = {
    aws = aws
  }
  
  vpc_id            = module.aws_networking[0].vpc_id
  subnet_ids        = module.aws_networking[0].private_subnet_ids
  container_image   = var.container_image
  replicas          = var.replicas
  redis_endpoint    = module.aws_redis[0].endpoint
  environment       = var.environment
}

# Outputs
output "ai_server_endpoint" {
  description = "AI Server endpoint URL"
  value       = local.is_aws ? module.aws_ai_server[0].endpoint : null
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = local.is_aws ? module.aws_redis[0].endpoint : null
  sensitive   = true
}
