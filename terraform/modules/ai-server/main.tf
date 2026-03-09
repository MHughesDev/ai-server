# AWS ECS Fargate Module for AI Server

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "container_image" {
  type = string
}

variable "replicas" {
  type = number
}

variable "redis_endpoint" {
  type = string
}

variable "environment" {
  type = string
}

# ECS Cluster
resource "aws_ecs_cluster" "ai_server" {
  name = "ai-server-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      
      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }
}

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/ecs/ai-server-exec-${var.environment}"
  retention_in_days = 7
}

# Task Definition
resource "aws_ecs_task_definition" "ai_server" {
  family                   = "ai-server-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "ai-server"
      image = var.container_image
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        },
        {
          containerPort = 3443
          protocol      = "tcp"
        }
      ]
      
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "LOG_LEVEL", value = "info" },
        { name = "REDIS_URL", value = "redis://${var.redis_endpoint}:6379" },
        { name = "QUEUE_BACKEND", value = "redis" },
        { name = "QUEUE_WORKERS_COUNT", value = "2" },
        { name = "MEMORY_PERSISTENT_BACKEND", value = "redis" }
      ]
      
      secrets = [
        {
          name      = "OPERATIONAL_BEARER_TOKEN"
          valueFrom = aws_secretsmanager_secret.operational_token.arn
        },
        {
          name      = "MODEL_PROVIDER_API_KEY"
          valueFrom = aws_secretsmanager_secret.model_api_key.arn
        },
        {
          name      = "AUTH_AI_JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ai_server.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/healthz || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
      
      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])
}

# ECS Service
resource "aws_ecs_service" "ai_server" {
  name            = "ai-server-${var.environment}"
  cluster         = aws_ecs_cluster.ai_server.id
  task_definition = aws_ecs_task_definition.ai_server.arn
  desired_count   = var.replicas
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ai_server.arn
    container_name   = "ai-server"
    container_port   = 3000
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  depends_on = [aws_lb_listener.https]

  propagate_tags = "SERVICE"

  tags = {
    Environment = var.environment
  }
}

# Application Load Balancer
resource "aws_lb" "ai_server" {
  name               = "ai-server-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.subnet_ids

  enable_deletion_protection = var.environment == "prod"

  access_logs {
    bucket  = aws_s3_bucket.logs.id
    prefix  = "alb-logs"
    enabled = true
  }
}

resource "aws_lb_target_group" "ai_server" {
  name     = "ai-server-${var.environment}"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/healthz"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.ai_server.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.ai_server.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ai_server.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.ai_server.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "ai_server" {
  max_capacity       = var.environment == "prod" ? 20 : 5
  min_capacity       = var.replicas
  resource_id        = "service/${aws_ecs_cluster.ai_server.name}/${aws_ecs_service.ai_server.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "ai-server-cpu-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ai_server.resource_id
  scalable_dimension = aws_appautoscaling_target.ai_server.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ai_server.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Security Groups
resource "aws_security_group" "alb" {
  name_prefix = "ai-server-alb-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "ai-server-ecs-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 3443
    to_port         = 3443
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# IAM Roles
resource "aws_iam_role" "ecs_execution" {
  name = "ai-server-ecs-execution-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "ai-server-ecs-task-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# Secrets Manager
resource "aws_secretsmanager_secret" "operational_token" {
  name = "ai-server/operational-token-${var.environment}"
}

resource "aws_secretsmanager_secret" "model_api_key" {
  name = "ai-server/model-api-key-${var.environment}"
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "ai-server/jwt-secret-${var.environment}"
}

# CloudWatch Logs
resource "aws_cloudwatch_log_group" "ai_server" {
  name              = "/ecs/ai-server-${var.environment}"
  retention_in_days = var.environment == "prod" ? 90 : 30
}

# S3 Bucket for Logs
resource "aws_s3_bucket" "logs" {
  bucket = "ai-server-logs-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

# Data Sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ACM Certificate (placeholder - requires manual validation)
resource "aws_acm_certificate" "ai_server" {
  domain_name       = "api-${var.environment}.example.com"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Outputs
output "endpoint" {
  value = "https://${aws_lb.ai_server.dns_name}"
}

output "alb_dns_name" {
  value = aws_lb.ai_server.dns_name
}
