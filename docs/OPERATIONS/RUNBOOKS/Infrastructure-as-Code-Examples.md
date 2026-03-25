# Infrastructure as Code Examples

This document provides Infrastructure-as-Code (IaC) examples for deploying the AI Server in production environments.

---

## Table of Contents

1. [Kubernetes Deployment](#kubernetes-deployment)
2. [Terraform Configuration](#terraform-configuration)
3. [Docker Compose](#docker-compose)
4. [Helm Chart](#helm-chart)
5. [AWS CloudFormation](#aws-cloudformation)

---

## Kubernetes Deployment

### Basic Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-server
  labels:
    app: ai-server
    environment: production
```

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-server-config
  namespace: ai-server
data:
  NODE_ENV: "production"
  PORT: "3000"
  MEMORY_BACKEND: "vector"
  MEMORY_RETRIEVAL_ENABLED: "true"
  PLATFORM_PRODUCTION_ROLLOUT_ENABLED: "true"
  LOG_LEVEL: "info"
  METRICS_ENABLED: "true"
  # Add other non-sensitive config here
```

```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-server-secrets
  namespace: ai-server
type: Opaque
stringData:
  OPERATIONAL_BEARER_TOKEN: "<generated-token>"
  AUTH_AI_JWT_SECRET: "<jwt-secret>"
  MODEL_GATEWAY_PROVIDERS_JSON: '<provider-config-json>'
  # Reference external secrets manager for production
  # AWS: secretsmanager:GetSecretValue
  # GCP: secretmanager:access
  # Azure: keyvault:GetSecret
```

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-server
  namespace: ai-server
  labels:
    app: ai-server
    version: v1.2.3
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: ai-server
  template:
    metadata:
      labels:
        app: ai-server
        version: v1.2.3
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - name: ai-server
          image: ai-server:v1.2.3
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: ai-server-config
            - secretRef:
                name: ai-server-secrets
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: RELEASE_ID
              value: "v1.2.3"
            - name: BUILD_ID
              value: "abc123"
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /readyz
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - ai-server
                topologyKey: kubernetes.io/hostname
```

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ai-server
  namespace: ai-server
  labels:
    app: ai-server
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
      name: http
  selector:
    app: ai-server
```

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-server
  namespace: ai-server
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/rate-limit: "1000"
spec:
  tls:
    - hosts:
        - api.example.com
      secretName: ai-server-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ai-server
                port:
                  number: 80
```

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-server
  namespace: ai-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: ai_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

```yaml
# k8s/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ai-server
  namespace: ai-server
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: ai-server
```

---

## Terraform Configuration

```hcl
# terraform/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
  backend "s3" {
    bucket = "ai-server-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "ai-server-cluster"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      desired_size = 3
      min_size     = 3
      max_size     = 20

      instance_types = ["m6i.xlarge"]
      capacity_type  = "ON_DEMAND"

      labels = {
        workload = "ai-server"
      }

      taints = []

      update_config = {
        max_unavailable_percentage = 25
      }
    }
  }

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
  }
}

# VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "ai-server-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Environment = "production"
    Application = "ai-server"
  }
}

# ElastiCache Redis (for rate limiting and config)
resource "aws_elasticache_replication_group" "ai_server" {
  replication_group_id = "ai-server-redis"
  description          = "Redis cluster for AI Server"

  node_type            = "cache.r6g.large"
  num_cache_clusters   = 2
  port                 = 6379
  parameter_group_name = "default.redis7"

  automatic_failover_enabled = true
  multi_az_enabled          = true

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  subnet_group_name  = aws_elasticache_subnet_group.ai_server.name
  security_group_ids = [aws_security_group.redis.id]
}

resource "aws_elasticache_subnet_group" "ai_server" {
  name       = "ai-server-redis"
  subnet_ids = module.vpc.private_subnets
}

# Secrets Manager
resource "aws_secretsmanager_secret" "ai_server" {
  name        = "ai-server/production"
  description = "AI Server production secrets"

  replica {
    region = var.secondary_region
  }
}

# Application Load Balancer
resource "aws_lb" "ai_server" {
  name               = "ai-server-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = true
  enable_http2              = true

  access_logs {
    bucket  = aws_s3_bucket.logs.bucket
    prefix  = "alb-logs"
    enabled = true
  }
}

# Variables
variable "aws_region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region for disaster recovery"
  default     = "us-west-2"
}

# Outputs
output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.ai_server.primary_endpoint_address
}
```

---

## Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  ai-server:
    build:
      context: .
      dockerfile: Dockerfile
    image: ai-server:latest
    container_name: ai-server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MEMORY_BACKEND=in_memory
      - OPERATIONAL_BEARER_TOKEN=${OPERATIONAL_BEARER_TOKEN}
      - AUTH_AI_JWT_SECRET=${AUTH_AI_JWT_SECRET}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    networks:
      - ai-server-network
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # Optional: Redis for shared state
  redis:
    image: redis:7-alpine
    container_name: ai-server-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - ai-server-network

  # Optional: Vector database (e.g., Weaviate)
  weaviate:
    image: semitechnologies/weaviate:1.21.0
    container_name: ai-server-weaviate
    ports:
      - "8080:8080"
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'none'
      ENABLE_MODULES: ''
    volumes:
      - weaviate-data:/var/lib/weaviate
    restart: unless-stopped
    networks:
      - ai-server-network

  # Prometheus for metrics
  prometheus:
    image: prom/prometheus:latest
    container_name: ai-server-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    restart: unless-stopped
    networks:
      - ai-server-network

  # Grafana for dashboards
  grafana:
    image: grafana/grafana:latest
    container_name: ai-server-grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    restart: unless-stopped
    networks:
      - ai-server-network

networks:
  ai-server-network:
    driver: bridge

volumes:
  redis-data:
  weaviate-data:
  prometheus-data:
  grafana-data:
```

---

## Helm Chart

```yaml
# helm/ai-server/Chart.yaml
apiVersion: v2
name: ai-server
description: A Helm chart for AI Server
type: application
version: 1.2.3
appVersion: "1.2.3"
keywords:
  - ai
  - ml
  - inference
home: https://github.com/example/ai-server
sources:
  - https://github.com/example/ai-server
maintainers:
  - name: AI Team
    email: ai-team@example.com
dependencies:
  - name: redis
    version: 18.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

```yaml
# helm/ai-server/values.yaml
# Default values for ai-server
replicaCount: 3

image:
  repository: ai-server
  pullPolicy: IfNotPresent
  tag: "v1.2.3"

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: ai-server-tls
      hosts:
        - api.example.com

resources:
  limits:
    cpu: 1000m
    memory: 2Gi
  requests:
    cpu: 250m
    memory: 512Mi

livenessProbe:
  httpGet:
    path: /healthz
    port: http
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /readyz
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
  metrics:
    - type: Pods
      pods:
        metric:
          name: ai_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"

pdb:
  enabled: true
  minAvailable: 2

nodeSelector: {}

tolerations: []

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - ai-server
          topologyKey: kubernetes.io/hostname

config:
  NODE_ENV: production
  PORT: "3000"
  MEMORY_BACKEND: vector
  MEMORY_RETRIEVAL_ENABLED: "true"
  PLATFORM_PRODUCTION_ROLLOUT_ENABLED: "true"
  LOG_LEVEL: info
  METRICS_ENABLED: "true"

secrets:
  OPERATIONAL_BEARER_TOKEN: ""
  AUTH_AI_JWT_SECRET: ""
  MODEL_GATEWAY_PROVIDERS_JSON: ""
  # Use external secrets manager in production
  useExternalSecret: true
  externalSecretName: ai-server-secrets

redis:
  enabled: true
  architecture: replication
  auth:
    enabled: true
  master:
    persistence:
      enabled: true
      size: 8Gi
  replica:
    persistence:
      enabled: true
      size: 8Gi
    replicaCount: 2
```

---

## AWS CloudFormation

```yaml
# cloudformation/ai-server-stack.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: AI Server Production Stack

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  
  VpcId:
    Type: AWS::EC2::VPC::Id
    Description: VPC for deployment
  
  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Description: Subnets for deployment
  
  ImageTag:
    Type: String
    Default: latest
    Description: Docker image tag

Resources:
  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub "ai-server-${Environment}"
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1
        - CapacityProvider: FARGATE_SPOT
          Weight: 1
      Settings:
        - Name: containerInsights
          Value: enabled

  # Task Definition
  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub "ai-server-${Environment}"
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: 1024
      Memory: 2048
      ExecutionRoleArn: !Ref ExecutionRole
      TaskRoleArn: !Ref TaskRole
      ContainerDefinitions:
        - Name: ai-server
          Image: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/ai-server:${ImageTag}"
          PortMappings:
            - ContainerPort: 3000
              Protocol: tcp
          Environment:
            - Name: NODE_ENV
              Value: !Ref Environment
            - Name: PORT
              Value: "3000"
          Secrets:
            - Name: OPERATIONAL_BEARER_TOKEN
              ValueFrom: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:ai-server/${Environment}/bearer-token"
            - Name: AUTH_AI_JWT_SECRET
              ValueFrom: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:ai-server/${Environment}/jwt-secret"
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: ai-server
          HealthCheck:
            Command:
              - CMD-SHELL
              - curl -f http://localhost:3000/healthz || exit 1
            Interval: 30
            Timeout: 5
            Retries: 3
            StartPeriod: 60

  # ECS Service
  ECSService:
    Type: AWS::ECS::Service
    DependsOn: ALBListener
    Properties:
      ServiceName: !Sub "ai-server-${Environment}"
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref TaskDefinition
      LaunchType: FARGATE
      DesiredCount: 3
      DeploymentConfiguration:
        MaximumPercent: 200
        MinimumHealthyPercent: 100
        DeploymentCircuitBreaker:
          Enable: true
          Rollback: true
      NetworkConfiguration:
        AwsvpcConfiguration:
          SecurityGroups:
            - !Ref ServiceSecurityGroup
          Subnets: !Ref SubnetIds
          AssignPublicIp: DISABLED
      LoadBalancers:
        - ContainerName: ai-server
          ContainerPort: 3000
          TargetGroupArn: !Ref TargetGroup

  # Auto Scaling
  ScalableTarget:
    Type: AWS::ApplicationAutoScaling::ScalableTarget
    Properties:
      ServiceNamespace: ecs
      ResourceId: !Sub "service/${ECSCluster}/${ECSService}"
      ScalableDimension: ecs:service:DesiredCount
      MinCapacity: 3
      MaxCapacity: 20
      RoleARN: !Sub "arn:aws:iam::${AWS::AccountId}:role/aws-service-role/ecs.application-autoscaling.amazonaws.com/AWSServiceRoleForApplicationAutoScaling_ECSService"

  ScalingPolicy:
    Type: AWS::ApplicationAutoScaling::ScalingPolicy
    Properties:
      PolicyName: !Sub "ai-server-scaling-${Environment}"
      PolicyType: TargetTrackingScaling
      ScalingTargetId: !Ref ScalableTarget
      TargetTrackingScalingPolicyConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ECSServiceAverageCPUUtilization
        TargetValue: 70.0
        ScaleInCooldown: 300
        ScaleOutCooldown: 60

  # Application Load Balancer
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub "ai-server-${Environment}"
      Scheme: internet-facing
      Type: application
      Subnets: !Ref SubnetIds
      SecurityGroups:
        - !Ref ALBSecurityGroup

  TargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub "ai-server-${Environment}"
      Port: 3000
      Protocol: HTTP
      VpcId: !Ref VpcId
      TargetType: ip
      HealthCheckPath: /healthz
      HealthCheckIntervalSeconds: 30
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3

  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ALB
      Port: 443
      Protocol: HTTPS
      Certificates:
        - CertificateArn: !Ref SSLCertificate
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref TargetGroup

  # Security Groups
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub "ai-server-alb-${Environment}"
      GroupDescription: Security group for ALB
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0

  ServiceSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupName: !Sub "ai-server-service-${Environment}"
      GroupDescription: Security group for ECS service
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3000
          ToPort: 3000
          SourceSecurityGroupId: !Ref ALBSecurityGroup

  # CloudWatch Log Group
  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub "/ecs/ai-server-${Environment}"
      RetentionInDays: 30

  # IAM Roles
  ExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "ai-server-execution-${Environment}"
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
      Policies:
        - PolicyName: SecretsAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - secretsmanager:GetSecretValue
                Resource: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:ai-server/${Environment}/*"

  TaskRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "ai-server-task-${Environment}"
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole

  # SSL Certificate (must be created separately or imported)
  SSLCertificate:
    Type: AWS::CertificateManager::Certificate
    Properties:
      DomainName: api.example.com
      ValidationMethod: DNS
      SubjectAlternativeNames:
        - '*.api.example.com'

Outputs:
  ALBEndpoint:
    Description: Application Load Balancer endpoint
    Value: !GetAtt ALB.DNSName
    Export:
      Name: !Sub "${AWS::StackName}-ALBEndpoint"
  
  ServiceName:
    Description: ECS Service name
    Value: !Ref ECSService
    Export:
      Name: !Sub "${AWS::StackName}-ServiceName"
```

---

## Cost Estimation Guide

### AWS Cost Breakdown (Monthly)

| Resource | Specs | Cost (USD) |
|----------|-------|------------|
| EKS Control Plane | 1x | $72 |
| EC2 (EKS nodes) | 3x m6i.xlarge | $420 |
| EC2 (auto-scaling) | 10x m6i.large avg | $700 |
| ElastiCache Redis | cache.r6g.large x2 | $350 |
| ALB | 1x | $25 |
| Data Transfer | ~500GB/mo | $45 |
| CloudWatch | Logs + Metrics | $100 |
| Secrets Manager | 10 secrets | $10 |
| **Total** | | **~$1,722/mo** |

### Scaling Costs

| Scale | Nodes | Monthly Cost |
|-------|-------|--------------|
| Small (3 nodes) | 3x m6i.large | $1,200 |
| Medium (default) | 3-10 mixed | $1,722 |
| Large (high traffic) | 10-20 m6i.xlarge | $3,500 |
| Enterprise | 20+ with GPU | $8,000+ |

---

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Helm Documentation](https://helm.sh/docs/)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- Plan: L2-08 Rollout and Operational Readiness
- Spec: 22 Runbooks and Operations
