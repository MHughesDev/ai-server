# Deployment Runbook

**Purpose:** Step-by-step procedures for deploying AI Server to production environments.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Procedures](#deployment-procedures)
3. [Post-Deployment Verification](#post-deployment-verification)
4. [Rollback Procedures](#rollback-procedures)
5. [Emergency Procedures](#emergency-procedures)

---

## Pre-Deployment Checklist

### 1. Code Readiness

- [ ] All tests pass (`npm run verify:sow`)
- [ ] Code review completed and approved
- [ ] No open security vulnerabilities (Snyk/Trivy scan)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated with release notes

### 2. Staging Validation

- [ ] Staging deployment successful
- [ ] Staging smoke tests pass
- [ ] Staging SLOs within 10% of baseline
- [ ] Staging canary successful (if applicable)
- [ ] Integration tests pass in staging

### 3. Production Readiness

- [ ] Operational runbooks reviewed
- [ ] On-call team notified
- [ ] Monitoring dashboards verified
- [ ] Alert thresholds configured
- [ ] Rollback procedure tested recently

### 4. Deployment Artifacts

- [ ] Docker image built and scanned
- [ ] Image tagged with version and build ID
- [ ] Image pushed to production registry
- [ ] Helm chart version updated
- [ ] Infrastructure changes reviewed (if any)

---

## Deployment Procedures

### Standard Deployment (Blue/Green)

```bash
#!/bin/bash
# scripts/deploy.sh

set -euo pipefail

VERSION=${1:-}
ENVIRONMENT=${2:-production}

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [environment]"
    exit 1
fi

echo "=== Starting deployment of AI Server v${VERSION} to ${ENVIRONMENT} ==="

# 1. Pre-deployment verification
echo "Step 1: Pre-deployment verification"
kubectl config use-context ${ENVIRONMENT}
kubectl get nodes
kubectl get pods -n ${ENVIRONMENT} -l app=ai-server

# 2. Update ConfigMaps
echo "Step 2: Updating ConfigMaps"
kubectl apply -f k8s/configmap.yaml -n ${ENVIRONMENT}

# 3. Update Secrets (if needed)
echo "Step 3: Checking Secrets"
kubectl get secret ai-server-secrets -n ${ENVIRONMENT}

# 4. Deploy with new version
echo "Step 4: Deploying new version"
cat k8s/deployment.yaml | \
    sed "s|image: ai-server:.*|image: ai-server:${VERSION}|g" | \
    kubectl apply -f - -n ${ENVIRONMENT}

# 5. Wait for rollout
echo "Step 5: Waiting for rollout"
kubectl rollout status deployment/ai-server -n ${ENVIRONMENT} --timeout=300s

# 6. Verify deployment
echo "Step 6: Verifying deployment"
./scripts/verify-deployment.sh ${ENVIRONMENT}

echo "=== Deployment complete ==="
```

### Canary Deployment (Recommended)

```bash
#!/bin/bash
# scripts/deploy-canary.sh

set -euo pipefail

VERSION=${1:-}
CANARY_PERCENTAGE=${2:-10}
ENVIRONMENT=${3:-production}

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [canary_percentage] [environment]"
    exit 1
fi

echo "=== Starting canary deployment of AI Server v${VERSION} ==="
echo "Canary percentage: ${CANANRY_PERCENTAGE}%"

# 1. Deploy canary
echo "Step 1: Deploying canary"
cat k8s/canary-deployment.yaml | \
    sed "s|image: ai-server:.*|image: ai-server:${VERSION}|g" | \
    sed "s|replicas: .*|replicas: 1|g" | \
    kubectl apply -f - -n ${ENVIRONMENT}

# 2. Wait for canary ready
echo "Step 2: Waiting for canary to be ready"
kubectl wait --for=condition=ready pod \
    -l app=ai-server,canary=true \
    -n ${ENVIRONMENT} \
    --timeout=120s

# 3. Route traffic to canary
echo "Step 3: Routing ${CANARY_PERCENTAGE}% traffic to canary"
kubectl patch service ai-server -n ${ENVIRONMENT} --patch '{"spec":{"selector":{"canary":"true"}}}'

# 4. Monitor canary
echo "Step 4: Monitoring canary for 10 minutes"
sleep 600

# 5. Verify canary metrics
echo "Step 5: Verifying canary metrics"
./scripts/check-canary-metrics.sh

# 6. Promote or rollback
echo "Step 6: Promoting canary to full deployment"
kubectl patch deployment ai-server -n ${ENVIRONMENT} --patch "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"ai-server\",\"image\":\"ai-server:${VERSION}\"}]}}}}"

# 7. Remove canary
echo "Step 7: Removing canary"
kubectl delete deployment ai-server-canary -n ${ENVIRONMENT}

echo "=== Canary deployment complete ==="
```

### Helm Deployment

```bash
#!/bin/bash
# scripts/deploy-helm.sh

set -euo pipefail

VERSION=${1:-}
ENVIRONMENT=${2:-production}
NAMESPACE=${3:-ai-server}

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [environment] [namespace]"
    exit 1
fi

echo "=== Deploying AI Server v${VERSION} via Helm ==="

# Upgrade/Install with Helm
helm upgrade --install ai-server ./helm/ai-server \
    --namespace ${NAMESPACE} \
    --set image.tag=${VERSION} \
    --set config.RELEASE_ID=${VERSION} \
    --set config.BUILD_ID=$(git rev-parse --short HEAD) \
    --values ./helm/values-${ENVIRONMENT}.yaml \
    --wait \
    --timeout 600s

# Verify
helm status ai-server -n ${NAMESPACE}
kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/name=ai-server

echo "=== Helm deployment complete ==="
```

---

## Post-Deployment Verification

### 1. Health Check Verification

```bash
#!/bin/bash
# scripts/verify-deployment.sh

ENVIRONMENT=${1:-production}
ENDPOINT="https://api.example.com"

if [ "$ENVIRONMENT" == "staging" ]; then
    ENDPOINT="https://staging-api.example.com"
fi

echo "=== Verifying deployment at ${ENDPOINT} ==="

# Health check
echo "1. Checking /healthz"
curl -sf ${ENDPOINT}/healthz || exit 1
echo "   ✓ Health check passed"

# Readiness check
echo "2. Checking /readyz"
curl -sf ${ENDPOINT}/readyz || exit 1
echo "   ✓ Readiness check passed"

# Version check
echo "3. Checking /v1/version"
curl -sf ${ENDPOINT}/v1/version | jq .
echo "   ✓ Version endpoint working"

# Metrics endpoint
echo "4. Checking /metrics"
curl -sf ${ENDPOINT}/metrics > /dev/null || exit 1
echo "   ✓ Metrics endpoint accessible"

# Basic functionality
echo "5. Testing basic query"
curl -sf -X POST ${ENDPOINT}/v1/query \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TEST_TOKEN}" \
    -d '{"prompt": "Hello", "scope": {"org_id": "test", "app_id": "test", "user_id": "test"}}' \
    | jq -e '.status == "success"' || exit 1
echo "   ✓ Basic query working"

echo "=== All verifications passed ==="
```

### 2. Smoke Test Suite

```bash
#!/bin/bash
# scripts/smoke-tests.sh

set -euo pipefail

ENVIRONMENT=${1:-production}
ENDPOINT=${2:-https://api.example.com}
TOKEN=${3:-$OPERATIONAL_BEARER_TOKEN}

echo "=== Running smoke tests on ${ENVIRONMENT} ==="

# Test 1: Intent submission
echo "Test 1: Intent submission"
RESPONSE=$(curl -sf -X POST ${ENDPOINT}/v1/intent \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "version": "2024-01-01",
        "request_id": "smoke-test-1",
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "intent": {
            "intent_id": "smoke-intent-1",
            "scope": {"org_id": "smoke", "app_id": "test", "user_id": "test"},
            "input_artifacts": []
        }
    }')
echo "$RESPONSE" | jq -e '.status == "accepted" or .status == "rejected"'
echo "   ✓ Intent submission working"

# Test 2: Memory retrieval (if enabled)
echo "Test 2: Memory retrieval"
RESPONSE=$(curl -sf -X POST ${ENDPOINT}/v1/retrieve \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{
        "query_text": "test",
        "scope": "org",
        "scope_keys": {"org_id": "smoke"},
        "top_k": 5
    }')
echo "$RESPONSE" | jq -e '.degraded == true or (.hits | length) >= 0'
echo "   ✓ Memory retrieval working"

# Test 3: Rate limiting
echo "Test 3: Rate limiting"
for i in {1..5}; do
    curl -sf -X POST ${ENDPOINT}/v1/query \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{"prompt": "test", "scope": {"org_id": "smoke", "app_id": "test", "user_id": "test"}}' \
        > /dev/null
done
echo "   ✓ Rate limiting functional"

echo "=== Smoke tests passed ==="
```

### 3. Monitoring Verification

```bash
#!/bin/bash
# scripts/verify-monitoring.sh

ENVIRONMENT=${1:-production}

echo "=== Verifying monitoring for ${ENVIRONMENT} ==="

# Check Prometheus targets
echo "1. Checking Prometheus targets"
curl -sf http://prometheus.example.com/api/v1/targets | \
    jq -e '.data.activeTargets[] | select(.labels.job == "ai-server") | .health == "up"'
echo "   ✓ Prometheus scraping"

# Check alerts are not firing
echo "2. Checking for firing alerts"
ALERTS=$(curl -sf http://alertmanager.example.com/api/v1/alerts | \
    jq '[.data[] | select(.status.state == "firing")] | length')
if [ "$ALERTS" -eq "0" ]; then
    echo "   ✓ No firing alerts"
else
    echo "   ⚠ $ALERTS alerts firing"
fi

# Check Grafana dashboards
echo "3. Checking Grafana"
curl -sf http://grafana.example.com/api/dashboards/uid/ai-server-overview > /dev/null
echo "   ✓ Grafana dashboards accessible"

echo "=== Monitoring verification complete ==="
```

---

## Rollback Procedures

### Quick Rollback

```bash
#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

ENVIRONMENT=${1:-production}
PREVIOUS_VERSION=${2:-}

if [ -z "$PREVIOUS_VERSION" ]; then
    echo "Usage: $0 <environment> <previous_version>"
    exit 1
fi

echo "=== ROLLING BACK ${ENVIRONMENT} to v${PREVIOUS_VERSION} ==="

# 1. Trigger rollback
echo "Step 1: Rolling back deployment"
kubectl rollout undo deployment/ai-server -n ${ENVIRONMENT}

# OR: Explicit rollback to version
# kubectl set image deployment/ai-server ai-server=ai-server:${PREVIOUS_VERSION} -n ${ENVIRONMENT}

# 2. Wait for rollback
echo "Step 2: Waiting for rollback"
kubectl rollout status deployment/ai-server -n ${ENVIRONMENT} --timeout=300s

# 3. Verify
echo "Step 3: Verifying rollback"
./scripts/verify-deployment.sh ${ENVIRONMENT}

echo "=== Rollback complete ==="
echo "Current version: $(kubectl get deployment ai-server -n ${ENVIRONMENT} -o json | jq -r '.spec.template.spec.containers[0].image')"
```

### Emergency Rollback

In case of critical failure requiring immediate rollback:

```bash
# 1. Scale canary to 0 (if canary deployment)
kubectl scale deployment ai-server-canary --replicas=0 -n production

# 2. Restore previous stable deployment
kubectl rollout undo deployment/ai-server -n production --to-revision=2

# 3. Verify stable is serving traffic
kubectl get pods -n production -l app=ai-server,canary!=true

# 4. Update service selector to point to stable
kubectl patch service ai-server -n production --patch '{"spec":{"selector":{"app":"ai-server","canary":null}}}'
```

---

## Emergency Procedures

### Kill Switch Activation

If a critical issue is discovered, activate kill switches:

```bash
# Disable retrieval
kubectl patch configmap ai-server-config -n production --patch '{"data":{"MEMORY_RETRIEVAL_ENABLED":"false"}}'

# Disable rollout
kubectl patch configmap ai-server-config -n production --patch '{"data":{"PLATFORM_PRODUCTION_ROLLOUT_ENABLED":"false"}}'

# Disable specific features
kubectl patch configmap ai-server-config -n production --patch '{"data":{"FEATURE_X_ENABLED":"false"}}'

# Restart to apply
kubectl rollout restart deployment/ai-server -n production
```

### Circuit Breaker Patterns

```bash
# Disable model gateway (fail-fast mode)
kubectl patch configmap ai-server-config -n production \
    --patch '{"data":{"MODEL_GATEWAY_CIRCUIT_BREAKER":"open"}}'

# Disable tool execution
kubectl patch configmap ai-server-config -n production \
    --patch '{"data":{"TOOL_GATEWAY_ENABLED":"false"}}'

# Throttle requests
kubectl patch configmap ai-server-config -n production \
    --patch '{"data":{"MAX_CONCURRENT_REQUESTS":"10"}}'
```

### Incident Response

1. **Acknowledge Alert** (within 5 minutes)
   - Confirm receipt in PagerDuty/Opsgenie
   - Join incident bridge/channel

2. **Assess Impact** (within 10 minutes)
   - Check error rates and affected users
   - Identify error types and scope
   - Determine if rollback needed

3. **Execute Mitigation** (within 15 minutes)
   - Apply kill switches if needed
   - Execute rollback if required
   - Scale up capacity if needed

4. **Communicate** (within 20 minutes)
   - Post incident summary
   - Update status page if customer-facing
   - Notify stakeholders

---

## Deployment Schedule

| Environment | Deployment Window | Approval Required |
|-------------|-------------------|-------------------|
| Development | Any time | No |
| Staging | Any time | No |
| Production | Tuesday-Thursday 9AM-4PM | Yes |
| Hotfix | Emergency only | Manager |

---

## Post-Deployment Checklist

- [ ] All health checks passing
- [ ] Error rates at baseline
- [ ] Latency p95 at baseline
- [ ] No new error types in logs
- [ ] Alerts not firing
- [ ] On-call team briefed on changes
- [ ] Documentation updated
- [ ] Runbooks updated (if needed)
- [ ] Incident response test scheduled

---

## References

- [Alert: Canary Failure](Alert-Canary-Failure.md)
- [Alert: Health Check Degradation](Alert-Health-Check-Degradation.md)
- [Release and Rollback](Release-and-Rollback.md)
- [Infrastructure as Code Examples](Infrastructure-as-Code-Examples.md)
- Plan: L2-08 Rollout and Operational Readiness
- Spec: 22 Runbooks and Operations
