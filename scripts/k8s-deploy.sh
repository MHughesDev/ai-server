#!/bin/bash
#
# Deploy AI Server to Kubernetes using Kustomize
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$PROJECT_DIR/k8s"

ENVIRONMENT="${1:-dev}"
NAMESPACE="ai-server-${ENVIRONMENT}"

echo "========================================"
echo "AI Server Kubernetes Deployment"
echo "Environment: ${ENVIRONMENT}"
echo "========================================"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo "Error: Environment must be one of: dev, staging, prod"
    echo "Usage: $0 [dev|staging|prod]"
    exit 1
fi

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "Error: kubectl is required"; exit 1; }
command -v kustomize >/dev/null 2>&1 || { echo "Warning: kustomize not found, using kubectl kustomize"; }

KUSTOMIZE="$(command -v kustomize || echo 'kubectl kustomize')"

# Validate secrets exist
if [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "staging" ]; then
    echo "Checking secrets..."
    if ! kubectl get secret ai-server-secrets -n "$NAMESPACE" 2>/dev/null; then
        echo ""
        echo "WARNING: Secret 'ai-server-secrets' not found in namespace '$NAMESPACE'"
        echo "Create it with:"
        echo "  kubectl create secret generic ai-server-secrets -n $NAMESPACE \\"
        echo "    --from-literal=OPERATIONAL_BEARER_TOKEN=... \\"
        echo "    --from-literal=MODEL_PROVIDER_API_KEY=..."
        echo ""
        read -p "Continue anyway? (y/N): " continue_anyway
        if [[ ! $continue_anyway =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Apply configuration
echo "Applying Kustomize configuration..."
cd "$K8S_DIR/overlays/$ENVIRONMENT"
$KUSTOMIZE build . | kubectl apply -f -

echo ""
echo "Waiting for deployment to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/${ENVIRONMENT}-ai-server -n "$NAMESPACE"

echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""

# Show status
echo "Pods:"
kubectl get pods -n "$NAMESPACE"
echo ""
echo "Services:"
kubectl get services -n "$NAMESPACE"
echo ""

# Health check endpoint
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "Port-forwarding for health check..."
    kubectl port-forward -n "$NAMESPACE" "svc/${ENVIRONMENT}-ai-server" 8080:80 &
    PF_PID=$!
    sleep 2
    curl -s http://localhost:8080/healthz || true
    kill $PF_PID 2>/dev/null || true
fi

echo ""
echo "Useful commands:"
echo "  kubectl logs -f deployment/${ENVIRONMENT}-ai-server -n $NAMESPACE"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl exec -it deployment/${ENVIRONMENT}-ai-server -n $NAMESPACE -- /bin/sh"
