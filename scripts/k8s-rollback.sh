#!/bin/bash
#
# Rollback AI Server deployment to previous version
#

set -e

ENVIRONMENT="${1:-dev}"
NAMESPACE="ai-server-${ENVIRONMENT}"

echo "========================================"
echo "AI Server Rollback"
echo "Environment: ${ENVIRONMENT}"
echo "========================================"
echo ""

# Show current revision
echo "Current deployment:"
kubectl rollout history deployment/${ENVIRONMENT}-ai-server -n "$NAMESPACE"
echo ""

# Ask for confirmation
read -p "Rollback to previous revision? (y/N): " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 0
fi

# Perform rollback
echo "Rolling back..."
kubectl rollout undo deployment/${ENVIRONMENT}-ai-server -n "$NAMESPACE"

# Wait for rollout
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/${ENVIRONMENT}-ai-server -n "$NAMESPACE" --timeout=120s

echo ""
echo "========================================"
echo "Rollback complete!"
echo "========================================"
echo ""
kubectl get pods -n "$NAMESPACE"
