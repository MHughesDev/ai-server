#!/bin/bash
#
# Verify Kubernetes deployment health
#

set -e

ENVIRONMENT="${1:-dev}"
NAMESPACE="ai-server-${ENVIRONMENT}"

echo "========================================"
echo "AI Server Health Verification"
echo "Environment: ${ENVIRONMENT}"
echo "========================================"
echo ""

# Check pods
echo "Checking pods..."
PODS=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=ai-server -o jsonpath='{.items[*].metadata.name}')
if [ -z "$PODS" ]; then
    echo "ERROR: No pods found"
    exit 1
fi

for pod in $PODS; do
    STATUS=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
    READY=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].ready}')
    echo "  $pod: Phase=$STATUS, Ready=$READY"
    
    if [ "$STATUS" != "Running" ] || [ "$READY" != "true" ]; then
        echo "ERROR: Pod $pod is not ready"
        kubectl describe pod "$pod" -n "$NAMESPACE"
        exit 1
    fi
done
echo "  ✓ All pods are running"
echo ""

# Check health endpoint
echo "Checking health endpoint..."
kubectl port-forward -n "$NAMESPACE" "svc/${ENVIRONMENT}-ai-server" 8080:80 &
PF_PID=$!
sleep 3

HEALTH=$(curl -s http://localhost:8080/healthz || echo "FAILED")
kill $PF_PID 2>/dev/null || true

if echo "$HEALTH" | grep -q "healthy"; then
    echo "  ✓ Health check passed"
    echo "  Response: $HEALTH"
else
    echo "ERROR: Health check failed"
    echo "Response: $HEALTH"
    exit 1
fi
echo ""

# Check Redis
echo "Checking Redis..."
REDIS_POD=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=redis -o jsonpath='{.items[0].metadata.name}')
if kubectl exec -n "$NAMESPACE" "$REDIS_POD" -- redis-cli ping | grep -q "PONG"; then
    echo "  ✓ Redis is responding"
else
    echo "ERROR: Redis is not responding"
    exit 1
fi
echo ""

echo "========================================"
echo "All checks passed!"
echo "========================================"
