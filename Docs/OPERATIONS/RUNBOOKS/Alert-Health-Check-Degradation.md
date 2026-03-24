# Alert Runbook: Health Check Degradation

**Alert Name:** `AIServer_Health_Check_Degraded`  
**Severity:** Warning -> Critical (if persists)  
**Description:** Health or readiness probe returning non-200 status or slow responses

---

## Alert Conditions

This alert fires when:
- `/healthz` returns non-200 for > 30 seconds
- `/readyz` returns 503 for > 60 seconds
- Health check response time > 5 seconds for > 2 minutes
- Dependency health check fails (model gateway, memory store, IdP)

---

## Immediate Actions (First 5 minutes)

### 1. Verify Alert
```bash
# Check health endpoint from inside cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -s http://ai-server.production.svc.cluster.local:3000/healthz

# Check readiness endpoint
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -s http://ai-server.production.svc.cluster.local:3000/readyz

# Check from outside
curl https://api.example.com/healthz
curl https://api.example.com/readyz
```

### 2. Check Pod Status
```bash
# List all pods
kubectl get pods -n production -l app=ai-server

# Check for restarts
kubectl get pods -n production -l app=ai-server -o json | \
  jq '.items[] | {name: .metadata.name, restarts: .status.containerStatuses[0].restartCount}'

# Check pod events
kubectl describe pods -n production -l app=ai-server | grep -A 5 Events
```

### 3. Check Resource Usage
```bash
# CPU/Memory usage
kubectl top pods -n production -l app=ai-server

# Node resources
kubectl top nodes

# Check for OOM kills
kubectl get pods -n production -l app=ai-server -o json | \
  jq '.items[].status.containerStatuses[].lastState.terminated'
```

---

## Diagnostic Procedures

### Case 1: Liveness Failing (`/healthz` non-200)

**Symptoms:**
- Kubernetes restarting pods
- `CrashLoopBackOff` in pod status

**Investigation:**
```bash
# Check recent logs before restart
kubectl logs -n production -l app=ai-server --previous --tail=100

# Look for panics or fatal errors
kubectl logs -n production -l app=ai-server --previous | grep -i \
  -e "panic" -e "fatal" -e "uncaught" -e "exception"

# Check for port binding issues
kubectl logs -n production -l app=ai-server --previous | grep -i \
  -e "eaddrinuse" -e "port" -e "listen"
```

**Common Causes:**
1. **Port conflict** - Another process using port 3000
2. **Startup failure** - Database connection failing
3. **Config error** - Invalid configuration causing crash
4. **Memory leak** - Process OOM killed

### Case 2: Readiness Failing (`/readyz` 503)

**Symptoms:**
- Pods running but not serving traffic
- Service endpoints empty
- Load balancer returning 503

**Investigation:**
```bash
# Check readyz response body
curl -s http://ai-server.production.svc.cluster.local:3000/readyz | jq .

# Check dependency health
# If using custom health checks, verify each dependency:

# Check model gateway connectivity
kubectl logs -n production -l app=ai-server | grep -i "model.*gateway"

# Check memory store connectivity
kubectl logs -n production -l app=ai-server | grep -i "memory.*store"

# Check IdP connectivity
kubectl logs -n production -l app=ai-server | grep -i "idp\|identity"
```

**Common Causes:**
1. **Model provider down** - Can't connect to OpenAI/Anthropic
2. **Memory store unavailable** - Redis/vector DB connection failing
3. **IdP unavailable** - Authentication service down
4. **Database down** - Config/tenant database unreachable

### Case 3: Slow Health Checks

**Symptoms:**
- Health checks taking > 5 seconds
- Kubernetes marking pods as not ready intermittently
- Flapping readiness state

**Investigation:**
```bash
# Time the health check
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  time curl -s http://ai-server.production.svc.cluster.local:3000/readyz

# Check for goroutine leaks
kubectl logs -n production -l app=ai-server | grep -i "goroutine"

# Check for blocked connections
kubectl logs -n production -l app=ai-server | grep -i "timeout\|blocked"

# Check network issues
kubectl exec -n production deploy/ai-server -- netstat -an | grep TIME_WAIT
```

---

## Resolution Actions

### Immediate Fixes

| Issue | Action |
|-------|--------|
| Dependency down | Set dependency to "optional" in health config (if supported) or wait for recovery |
| Slow health check | Increase probe timeout (temporary) |
| Port conflict | Restart pod, investigate root cause |
| Config error | Fix config, redeploy |
| Resource exhaustion | Scale up nodes, increase memory limits |

### Temporary Mitigations

**Disable strict readiness (temporary):**
```bash
# Edit deployment to make readiness less strict
kubectl edit deployment ai-server -n production

# Temporarily increase failure threshold
# readinessProbe:
#   failureThreshold: 10  # was 3
#   timeoutSeconds: 10    # was 5
```

**Increase replicas:**
```bash
# Scale up to maintain availability during investigation
kubectl scale deployment ai-server --replicas=10 -n production
```

---

## Verification

After fixes:
```bash
# Verify health endpoint
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://api.example.com/healthz
  sleep 1
done

# Verify readiness
for i in {1..10}; do
  curl -s http://api.example.com/readyz | jq -r '.status'
  sleep 1
done

# Check all pods are ready
kubectl get pods -n production -l app=ai-server | grep -v "1/1"
```

---

## Prevention

### Monitoring Improvements
- Add per-dependency health metrics
- Alert on dependency latency trends
- Implement health check caching (don't check all deps on every probe)

### Deployment Improvements
- Staged rollout of health check changes
- Test health endpoints in staging with simulated failures

### Code Improvements
- Implement health check timeout guards
- Add circuit breakers for dependency checks
- Implement graceful degradation (non-critical deps optional)

---

## Escalation

| Time | Action |
|------|--------|
| 0 min | Alert fires, on-call engineer notified |
| 10 min | If health checks not recovered, page team lead |
| 20 min | If service impact detected, page engineering manager |
| 30 min | If not resolved, page director, consider failover |

---

## Related Runbooks
- [Memory Retrieval Outage](Memory-Retrieval-Outage.md)
- [Query and Policy Failures](Query-and-Policy-Failures.md)
- [Release and Rollback](Release-and-Rollback.md)

## References
- Spec: 18 Observability Spec (Health Checks)
- Plan: L2-04 Observability and Evaluation
