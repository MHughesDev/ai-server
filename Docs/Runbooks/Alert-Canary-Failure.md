# Alert Runbook: Canary Failure

**Alert Name:** `AIServer_Canary_Failure_Rate_High`  
**Severity:** Critical  
**Description:** Triggered when canary deployment error rate exceeds threshold (default: 5%)

---

## Alert Conditions

This alert fires when:
- Canary deployment error rate > 5% over 5-minute window
- OR canary latency p95 > 2x baseline over 5-minute window
- OR canary deployment success rate drops below 95%

---

## Immediate Actions (First 5 minutes)

### 1. Verify Alert Validity
```bash
# Check current canary metrics
curl https://api.example.com/metrics | grep canary
curl https://api.example.com/metrics | grep error_rate

# Compare canary vs stable metrics
grep "canary.*error_rate" /var/log/ai-server/metrics.log
grep "stable.*error_rate" /var/log/ai-server/metrics.log
```

### 2. Check Canary Deployment Status
```bash
# Get current rollout status
kubectl get rollout ai-server -n production
kubectl describe rollout ai-server -n production

# Check canary pod status
kubectl get pods -n production -l app=ai-server,canary=true
kubectl logs -n production -l app=ai-server,canary=true --tail=100
```

### 3. Identify Error Patterns
```bash
# Check for specific error types
kubectl logs -n production -l app=ai-server,canary=true | grep -i error
kubectl logs -n production -l app=ai-server,canary=true | grep -i exception

# Check recent deployments
kubectl rollout history deployment/ai-server -n production
```

---

## Decision Matrix

| Condition | Action |
|-----------|--------|
| Error rate < 10%, stable metrics | Monitor, continue canary |
| Error rate 10-50% | Pause rollout, investigate |
| Error rate > 50% | **Immediate rollback** |
| Latency 2-3x baseline | Monitor, investigate |
| Latency > 3x baseline | **Immediate rollback** |
| New error type detected | **Immediate rollback** |

---

## Rollback Procedure

### Automated Rollback (Preferred)
```bash
# Trigger automated rollback via rollout policy
curl -X POST https://api.example.com/admin/rollout/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "canary_failure_alert", "alert_id": "<alert-id>"}'

# Verify rollback
kubectl get rollout ai-server -n production
watch kubectl get pods -n production -l app=ai-server
```

### Manual Rollback (Emergency)
```bash
# If automated rollback fails, manually rollback
kubectl rollout undo deployment/ai-server -n production

# Scale down canary
kubectl scale deployment ai-server-canary --replicas=0 -n production

# Verify stable is serving 100%
kubectl get pods -n production -l app=ai-server,canary!=true
```

---

## Post-Rollback Investigation

### 1. Collect Evidence
```bash
# Save canary logs before pods are terminated
kubectl logs -n production -l app=ai-server,canary=true > /tmp/canary-logs-$(date +%Y%m%d-%H%M%S).txt

# Export metrics
curl https://api.example.com/metrics > /tmp/metrics-$(date +%Y%m%d-%H%M%S).txt

# Get pod events
kubectl get events -n production --sort-by=.lastTimestamp | grep ai-server
```

### 2. Common Causes Checklist
- [ ] New code has uncaught exceptions
- [ ] Database migration didn't run
- [ ] Config change not applied to canary
- [ ] Environment variable missing
- [ ] Dependency service unavailable
- [ ] Memory leak causing OOM kills
- [ ] Network/connectivity issues

### 3. Create Incident Report
Document:
- Time alert fired
- Error rate and latency metrics
- Rollback time
- Root cause (post-investigation)
- Prevention measures

---

## Prevention

### Pre-Deployment Checklist
- [ ] All tests pass (`npm run verify:sow`)
- [ ] Staging canary successful
- [ ] SLOs within 10% of baseline in staging
- [ ] No new error types in staging logs
- [ ] Rollback procedure tested recently

### Monitoring Improvements
- [ ] Reduce alert threshold for new deployments
- [ ] Add alert for new error types
- [ ] Set up automatic rollback on critical errors
- [ ] Implement predictive canary analysis (Phase 12)

---

## Escalation

| Time | Action |
|------|--------|
| 0 min | Alert fires, on-call engineer notified |
| 5 min | If no acknowledgment, page team lead |
| 10 min | If rollback not initiated, page engineering manager |
| 15 min | If still unresolved, page director |

---

## Related Runbooks
- [Release and Rollback](Release-and-Rollback.md)
- [Query and Policy Failures](Query-and-Policy-Failures.md)
- [Observability and Eval](Observability-and-Eval.md)

## References
- Plan: L2-08 Rollout and Operational Readiness
- Spec: 20 Config and FeatureFlags, 22 Runbooks and Operations
