# L2-99 Evidence Checklist and Owner Matrix (OPS-006 / PR-034)

Evidence owners and artifact links for the Deferred Coding Agent Harness Readiness Gate. Validated by `validateEvidence()` in `src/governance/evidence.ts` when running `npm run harness-readiness:record`.

| Evidence ID | Dimension | Owner | Source plan | Artifact / link |
|-------------|-----------|-------|-------------|-----------------|
| hrg-security-auth | security | Security Lead | L2-05 | `src/config/assert-production-auth.ts` |
| hrg-security-tools | security | Security Lead | L2-05 | `src/config/assert-production-tool-execution.ts` |
| hrg-policy-preflight | policy_enforcement | Platform Lead | L2-03 | `src/server/preflight.ts` |
| hrg-policy-evaluator | policy_enforcement | Platform Lead | L2-03 | `src/controlplane/policy-evaluator.ts` |
| hrg-observability-acceptance | observability | SRE Lead | L2-04 | `src/observability/observability-acceptance.test.ts` |
| hrg-observability-harness-events | observability | SRE Lead | L2-04 | `src/observability/events.ts` (`HARNESS_ITERATION`) |
| hrg-reliability-rollback-drill | reliability | SRE Lead | L2-08 | `artifacts/rollback-drill-evidence.json` |
| hrg-operations-incident-drill | operations | Operations Lead | L2-08 | `artifacts/incident-drill-evidence.json` |
| hrg-operations-ci | operations | Platform Lead | L2-01 | `.github/workflows/ci.yml` |
| hrg-governance-go-no-go | governance | Program Lead | L2-08 | `artifacts/go-no-go-evidence-package.json` |
| hrg-governance-harness-pipeline | governance | Runtime Lead | L2-99 | `src/pipelines/coding-agent-pipeline.ts` |
| hrg-governance-harness-test | governance | QA Lead | L2-99 | `src/pipelines/coding-agent-pipeline.test.ts` |

## Recording the decision

```bash
export HARNESS_READINESS_SIGNATORIES_JSON="$(cat docs/OPERATIONS/templates/Harness-Readiness-Signatories.example.json)"
export HARNESS_READINESS_DECISION_JSON="$(cat docs/OPERATIONS/templates/Harness-Readiness-Decision.example.json)"
npm run harness-readiness:record
```

Output: **`artifacts/harness-readiness-decision.json`** — includes scorecard, `harness_enablement_approved`, and pilot constraints.

After **GO**, enable in production only with ops change control:

`HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true` (`harness_autonomous_execution_enabled` in config).
