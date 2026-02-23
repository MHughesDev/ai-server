# Release and Rollback Runbook (L2-08)

Runbook for release execution, canary analysis, rollback operations, and emergency mitigation. Owner: Operations Lead; escalation: SRE → Security → Leadership incident commander.

---

## Release execution

### Pre-deploy checklist

1. **Artifacts:** Ensure CI/CD has produced signed, traceable artifacts for the release. Version and build identity must be set (`RELEASE_ID` and/or `BUILD_ID` in deployment env).
2. **Config:** Feature flags and rollout gate:
   - `PLATFORM_PRODUCTION_ROLLOUT_ENABLED=true` only after production readiness gate is passed.
   - See `Docs/SPEC/20_Config_and_FeatureFlags.md` for all flags.
3. **Health gates:** Pre-deploy run `GET /healthz` and `GET /readyz` against current staging; confirm `GET /v1/version` returns expected `version`, `release_id`, `build_id`, and `env`.

### Deploy steps

1. Deploy to **staging** first; run smoke tests and verification checks.
2. If canary is used: deploy to canary cohort per **Canary analysis** below; observe for the configured window (see `src/rollout/policy.ts`: `observation_window_minutes`, default 15).
3. Promote to broader production only after canary success criteria are met.
4. Record release in your deployment/audit log (release_id, build_id, timestamp, approver).

### Verification

- `GET /v1/version` returns `contract_version`, `api`, `version`, and when set `release_id`, `build_id`, `env`.
- `GET /metrics` shows expected counters/histograms; no sustained error budget burn.

---

## Canary analysis

### Success/failure thresholds (L2-08)

Configured via rollout policy (see `src/rollout/policy.ts` and env or config):

| Criterion | Default | Meaning |
|-----------|--------|---------|
| `max_error_rate_promotion` | 0.01 | Max error rate (0–1) to allow promotion |
| `abort_error_rate` | 0.05 | Error rate above which canary is aborted |
| `max_p95_latency_ratio` | 1.1 | Max p95 vs baseline (e.g. 1.1 = 10% over) |
| `observation_window_minutes` | 15 | Window before promotion decision |

### Actions

1. During canary, monitor metrics (e.g. `GET /metrics`) or external dashboards when provisioned by ops for error rate, p95 latency, and cost (see Observability runbook).
2. **Promote** only if, over the observation window: error rate &lt; `max_error_rate_promotion`, p95 &lt; baseline × `max_p95_latency_ratio`, and no security/cost anomalies.
3. **Abort** if error rate ≥ `abort_error_rate` or SLO breach; trigger rollback per **Rollback operations** below.

---

## Rollback operations

### When to rollback

- SLO breach, security incident, cost anomaly, or severe defect (L2-08).
- Canary failure (see **Canary analysis**).

### Rollback steps

1. **Kill switch / gate:** Set `PLATFORM_PRODUCTION_ROLLOUT_ENABLED=false` (or equivalent) to stop new production traffic if the rollout gate is used to control traffic.
2. **Revert to last known good release:** Deploy the previous stable artifact (same process as release; use last signed release_id/build_id).
3. **Verify:** `GET /healthz`, `GET /readyz`, `GET /v1/version` on reverted instances; confirm metrics and logs show recovery.
4. **Incident protocol:** Open incident, notify on-call, and run postmortem per **Incident workflow** in `Docs/SPEC/22_Runbooks_and_Operations.md`.

### Recovery time

- Target: Rollback drill recovery time within the maximum recovery threshold defined for your environment (see L2-08 Phase 1 exit criteria).
- If rollback exceeds threshold in a drill, block production rollout until remediation (procedure, automation, or tooling).

---

## Emergency mitigation

### Severe outage or security event

1. **Immediate:** Activate rollback (revert to last stable release) and kill-switch controls as above.
2. **Communicate:** Notify Operations on-call, SRE, Security, and incident commander per escalation path.
3. **Contain:** If abuse or misuse is suspected, involve Security; preserve logs and audit artifacts (see L2-05 Security runbooks).
4. **Stabilize:** Do not re-enable production rollout until root cause is addressed and readiness checklist is re-validated.

### Escalation path (L2-08)

- **Alert owner:** Operations on-call; first escalation SRE.
- **Path:** Operations → SRE → Security → Leadership incident commander.

---

## Feature flags and kill switch

| Flag / Env | Purpose |
|------------|---------|
| `PLATFORM_PRODUCTION_ROLLOUT_ENABLED` | Production rollout gate; set `true` only after readiness gate. Default: `false`. |
| `RELEASE_ID` / `BUILD_ID` | Set at deploy for traceability; exposed in `GET /v1/version`. |

Kill switch: Use `PLATFORM_PRODUCTION_ROLLOUT_ENABLED=false` (and/or routing/load balancer changes) to stop directing production traffic to the new release while you roll back.

---

## References

- `Docs/PLANS/Implementation-plans/L2-08_Rollout-and-Operational-Readiness-Implementation.md`
- `Docs/SPEC/20_Config_and_FeatureFlags.md`
- `Docs/SPEC/22_Runbooks_and_Operations.md`
- `Docs/Runbooks/Observability-and-Eval.md`
