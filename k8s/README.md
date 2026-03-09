# AI Server Kubernetes Deployment

Production-ready Kubernetes manifests using Kustomize.

## Structure

```
k8s/
├── base/                    # Base manifests (reusable)
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── redis-statefulset.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   ├── ingress.yaml
│   └── kustomization.yaml
└── overlays/               # Environment-specific overlays
    ├── dev/
    ├── staging/
    └── prod/
```

## Quick Start

```bash
# Deploy to dev environment
./scripts/k8s-deploy.sh dev

# Deploy to staging
./scripts/k8s-deploy.sh staging

# Deploy to production
./scripts/k8s-deploy.sh prod
```

## Manual Deployment

```bash
# Using kustomize
cd k8s/overlays/dev
kustomize build . | kubectl apply -f -

# Or using kubectl
cd k8s/overlays/dev
kubectl apply -k .
```

## Prerequisites

- Kubernetes 1.24+
- kubectl configured
- kustomize (optional, kubectl has built-in)
- Ingress controller (nginx recommended)
- cert-manager (for TLS)

## Configuration

1. Update secrets:
```bash
kubectl create secret generic ai-server-secrets \
  --from-literal=OPERATIONAL_BEARER_TOKEN=... \
  --from-literal=MODEL_PROVIDER_API_KEY=... \
  -n ai-server-dev
```

2. Update ingress hostname in overlay kustomization.yaml

3. Configure image in base/kustomization.yaml

## Environments

| Environment | Replicas | Resources | Auto-scaling |
|-------------|----------|-----------|--------------|
| dev | 1 | 500m CPU, 512Mi | No |
| staging | 2 | 1000m CPU, 2Gi | Max 5 |
| prod | 3+ | 1000m CPU, 2Gi | Max 20 |

## Useful Commands

```bash
# View logs
kubectl logs -f deployment/dev-ai-server -n ai-server-dev

# Port forward
kubectl port-forward svc/dev-ai-server 8080:80 -n ai-server-dev

# Shell into pod
kubectl exec -it deployment/dev-ai-server -n ai-server-dev -- /bin/sh

# Check HPA
kubectl get hpa -n ai-server-dev

# Verify deployment
./scripts/k8s-verify.sh dev

# Rollback
./scripts/k8s-rollback.sh dev
```
