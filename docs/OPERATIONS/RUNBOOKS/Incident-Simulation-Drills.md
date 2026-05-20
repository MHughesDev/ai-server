# Incident Simulation Drills (PR-032 / L2-08 P2-02)

Executable drills that validate triage paths for **provider outage**, **policy deny**, and **budget exceeded**. Owner: Operations on-call; escalation: Operations → SRE → Security → Leadership incident commander.

## Automated drills (repo)

| Scenario | Simulation | Expected signal | Triage |
|----------|------------|-----------------|--------|
| **Provider** | Register failing `HealthCheckProvider` (`simulated_model_provider_outage`) | `GET /readyz` → **503**, `ready: false`; `GET /healthz` → **503**, `status: degraded` | [Query failures](Query-and-Policy-Failures.md#query-failure-general) |
| **Policy** | `POLICY_DENY_ORG_IDS=o1` + `POST /v1/query` | **200** `status: blocked`, `error.code: POLICY_BLOCKED` | [Policy / tool deny](Query-and-Policy-Failures.md#tool-denied) |
| **Budget** | Oversized input (~40k chars) + `POST /v1/query` | **200** `status: blocked`, `error.code: BUDGET_EXCEEDED` | [Budget exceeded](Query-and-Policy-Failures.md#budget-exceeded) |

### Commands

```bash
npm run drill:incidents
```

Writes **`artifacts/incident-drill-evidence.json`** with per-scenario `passed`, `duration_ms`, `observed_error_code`, and `triage_runbook` links.

### CI

GitHub Actions **`release-gates`** runs `incident-drills.integration.test.ts` and uploads **`incident-drill-evidence`** (90-day retention).

### Environment

- `INCIDENT_DRILL_EVIDENCE_PATH` — override evidence output path
- `POLICY_DENY_ORG_IDS` / `POLICY_DENY_APP_IDS` — used by policy evaluator (`src/controlplane/policy-evaluator.ts`)

## Manual staging drills (ops)

After automated drills pass in CI, run once per release in **staging**:

1. **Provider:** Block egress to model API or revoke API key; confirm error rate and `/readyz` behavior; restore and verify recovery.
2. **Policy:** Add tenant to deny list or disable pipeline in policy config; confirm `POLICY_BLOCKED` responses; revert policy.
3. **Budget:** Send high-token request or lower `token_budget` in policy; confirm `BUDGET_EXCEEDED`; tune budgets if false positive.

Record outcomes in your incident tracker (time, environment, approver). Attach CI evidence artifact or `artifacts/incident-drill-evidence.json` to the release record.

## Exit criteria (L2-08 Phase 2)

- All three automated scenarios **pass** in CI on the release branch.
- Staging manual drill checklist completed for the release (or risk acceptance documented).
- On-call confirms runbooks in **Query-and-Policy-Failures.md** match observed codes.

## References

- `src/operations/incident-drills.ts`
- `docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md`
- `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md`
