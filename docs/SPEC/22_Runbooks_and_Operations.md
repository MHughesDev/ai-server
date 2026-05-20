# 22 Runbooks and Operations

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 13, 18.2, 18.8, 18.9, 18.12).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` (endpoint protection, sink durability, lifecycle hardening, rollout enforcement).

## Operational Endpoints
- `GET /healthz`
- `GET /readyz`
- `GET /metrics`
- `GET /v1/version`

Production target: these endpoints must be protected by auth/mTLS/private network boundaries as appropriate.

## Runbook Index
| Runbook | Path | Purpose |
|---|---|---|
| Query and Policy Failures | `docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md` | Query errors, policy/tool denies, budget failures |
| Release and Rollback | `docs/OPERATIONS/RUNBOOKS/Release-and-Rollback.md` | Release execution, canary, rollback, emergency mitigation |
| Multimodal Input Path | `docs/OPERATIONS/RUNBOOKS/Multimodal-Input-Path.md` | Attachment validation and capability mismatch triage |
| Memory and Retrieval Outage | `docs/OPERATIONS/RUNBOOKS/Memory-Retrieval-Outage.md` | Retrieval degradation, citation quality, scope concerns |
| Harness Readiness Gate | `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md` | L2-99 governance gate and autonomous harness enablement |
| Observability and Eval | `docs/OPERATIONS/RUNBOOKS/Observability-and-Eval.md` | Events, metrics, eval regression, alert tuning |
| CI Bootstrap Troubleshooting | `docs/OPERATIONS/RUNBOOKS/CI-Bootstrap-Troubleshooting.md` | CI/build/bootstrap incident handling |
| Incident Simulation Drills | `docs/OPERATIONS/RUNBOOKS/Incident-Simulation-Drills.md` | Provider, policy, budget drills + evidence (PR-032) |
| Go / No-Go Decision | `docs/OPERATIONS/RUNBOOKS/Go-No-Go-Decision.md` | Signatories, evidence package, formal GO/NO-GO (PR-033) |

## On-Call and Escalation
- Primary owner: operations/platform on-call.
- Escalation path: operations -> SRE -> security -> incident commander.
- Security incidents require audit preservation and redaction-safe evidence handling.

## Operations Requirements
- Readiness reflects dependency health (not static success).
- Runtime behavior: `/healthz` and `/readyz` evaluate operational dependency status (including configured telemetry/audit sinks) and return `503` when unhealthy/unready.
- Startup must fail fast on invalid required configuration.
- Graceful shutdown and drain behavior must be available for production.
- Release metadata (`release_id`, `build_id`) must be present for traceability.

## Incident Workflow
Classify -> mitigate -> verify recovery -> communicate -> postmortem -> tracked follow-ups.
