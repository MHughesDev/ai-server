# Known Gaps – Consolidated by Area

Single quick-reference list of all known gaps from implementation plans and handoffs, grouped by area. For detail and verification commands, see the linked implementation plans and handoffs.

**Out of scope (not tracked here):** This project is a UI-less API server. Dashboard panels, admin UIs, and alert dashboards are not built or maintained in this repo; they are deferred to ops and external tooling (e.g. Grafana, Prometheus).

**Last consolidated:** 2026-02-18 (from L2-01 through L2-99 handoffs and L2-04 Gate Report).  
**Maintenance:** Update when handoffs or gate reports change. Owner: Tech Lead / Platform Lead (per Master plan).

---

## Summary

| Area | Plan | # Open | Key targets |
|------|------|--------|-------------|
| L2-01 | Contracts and project scaffold | 2 | Follow-up (streaming schema); scaffold stubs by design |
| L2-02 | MVP Runtime single endpoint chat | 0 | — |
| L2-03 | Policy, budgeting, and routing | 1 | Strategy weighting (—) |
| L2-04 | Observability and evaluation | 1 | Telemetry stack (alert drill when staging available) |
| L2-05 | Security isolation and compliance | 2 | Secrets manager; controlled tool execution (future) |
| L2-06 | Memory and retrieval | 4 | Production adapter; ops/SRE |
| L2-07 | Multimodal input path | 1 | — |
| L2-08 | Rollout and operational readiness | 5 | Operations; signatories; evidence package |
| L2-99 | Deferred coding agent harness readiness gate | 3 | Process-only; Phase 0 freeze |
| Master / cross-cutting | Master delivery plan | 2 | Before Plan 08 rollout; P0-03 |

---

## L2-02 – MVP Runtime (no open gaps)

L2-02 MVP Runtime single endpoint chat is complete; no open gaps in this plan. **Source:** [L2-02 Implementation Plan](L2-02_MVP-Runtime-Single-Endpoint-Chat.md).

---

## L2-01 – Contracts and project scaffold

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **Contracts: v1 only; no streaming schema** | Only v1 supported; no streaming schema yet | — | Follow-up |
| **Scaffold: interfaces/stubs only** | Component modules are interfaces/stubs only; no real routing, policy, or pipeline execution (by design for now) | — | — |
| **Config: env-based only** | **PARTIALLY ADDRESSED.** Optional central config via `CONFIG_FILE`; env remains primary. | — | — |
| **CI: no dependency or secret scanning** | **ADDRESSED.** CI runs `npm audit` (dependency audit) and `scripts/check-secrets.js` (secret scanning). | — | — |

**Source:** [L2-01 Implementation Plan](L2-01_Contracts-and-Project-Scaffold.md), [L2-01 Handoff](L2-01_Handoff.md).

---

## L2-03 – Policy, budgeting, and routing

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **Dynamic policy refresh** | **ADDRESSED.** Dynamic deny lists from env: `POLICY_DENY_ORG_IDS`, `POLICY_DENY_APP_IDS`. | — | — |
| **Shared budget counters** | **ADDRESSED.** Tenant cost cap per org via `TENANT_COST_CAP_USD_PER_HOUR` and `src/controlplane/tenant-budget.ts`. | — | — |
| **Strategy weighting** | Router uses a deterministic tie-breaker (chat); no advanced strategy weighting | — | — |

**Source:** [L2-03 Implementation Plan](L2-03_Policy-Budgeting-and-Routing-Implementation.md), [L2-03 Handoff](L2-03_Handoff.md).

---

## L2-04 – Observability and evaluation

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **Alert simulation drill** | P3-03 not run (telemetry stack not yet available) | SRE | When staging telemetry stack is available |
| **Sampling strategy** | **ADDRESSED.** Trace sampling via `OBSERVABILITY_TRACE_SAMPLE_RATE` / `observability_trace_sample_rate` and emitter `sampleRate`. | — | — |
| **Long-term event retention** | **ADDRESSED.** Optional event sink: `IEventSink`, `setEventSink`, `createFileEventSink`; enable via `OBSERVABILITY_EVENT_SINK_PATH` (NDJSON file). OTEL-style exporter can implement same interface. | — | — |
| **Eval dataset size** | **ADDRESSED.** Baseline expanded to 3 gold cases; expand further as L2-06/L2-07 features land. | QA Lead | As features land |

**Source:** [L2-04 Implementation Plan](L2-04_Observability-and-Evaluation-Implementation.md), [L2-04 Handoff](L2-04_Handoff.md), [L2-04 Gate Report and Known Gaps](L2-04_Gate-Report-and-Known-Gaps.md).

---

## L2-05 – Security isolation and compliance

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **Audit persistence** | **ADDRESSED.** Optional file sink via `AUDIT_LOG_PATH`, `setAuditSink`, and `createFileAuditSink`. | — | — |
| **Secrets manager** | Stub returns redacted placeholder; real resolution and rotation to be integrated per environment (e.g. env-based: `SECRET_<key>_<scope>` or JSON env) | — | Per-environment integration |
| **Controlled tool execution** | Enabling real tool execution is out of scope; prerequisites and policy hooks are in place for future cycles | — | Future cycles |

**Source:** [L2-05 Implementation Plan](L2-05_Security-Isolation-and-Compliance-Implementation.md), [L2-05 Handoff](L2-05_Handoff.md).

---

## L2-06 – Memory and retrieval

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **Store** | Default is in-memory (no vector DB); swap via setDefaultStore() or production adapter | — | Production adapter |
| **Ingestion** | Text-only chunking; no PDF parsing or real embeddings in MVP | — | — |
| **Ranking** | In-memory store uses simple text match; production should use vector similarity | — | Production |
| **Grounding** | Citation extraction only; no strict grounding score threshold in synthesis yet | — | — |

**Source:** [L2-06 Implementation Plan](L2-06_Memory-and-Retrieval-Implementation.md), [L2-06 Handoff](L2-06_Handoff.md).

---

## L2-07 – Multimodal input path

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **Preprocessing** | Deterministic token estimates only; no heavy image/PDF parsing or embedding in MVP | — | — |

*Note: Kill switch (MULTIMODAL_INPUT_PATH_ENABLED=false) is documented; not a gap. Dashboard/alert panels are out of scope for this repo (UI-less server).*

**Source:** [L2-07 Implementation Plan](L2-07_Multimodal-Input-Path-Implementation.md), [L2-07 Handoff](L2-07_Handoff.md).

---

## L2-08 – Rollout and operational readiness

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **CI/CD** | CI/CD artifact signing and deployment manifests (platform/SRE process) not done | Platform/SRE | Operations / platform |
| **Drills** | Canary and rollback drills with measured recovery time not yet executed | Operations | Operations |
| **Runbook validation** | Runbook validation by on-call owners and incident simulation drills not yet done | Operations / SRE | Operations |
| **Scorecard and go/no-go** | Production readiness scorecard and go/no-go decision not yet done | Operations + signatories | Operations + signatories |
| **Evidence package** | Operational evidence package and L2-99 handoff briefing not yet done | Operations | Operations |

**Source:** [L2-08 Implementation Plan](L2-08_Rollout-and-Operational-Readiness-Implementation.md), [L2-08 Handoff](L2-08_Handoff.md).

---

## L2-99 – Deferred coding agent harness readiness gate

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **Process-only** | Evidence collection, owner assignment, signatory approval, risk register updates, post-decision pilot/remediation plan are human/governance steps; no further code in this plan | — | — |
| **Integration/e2e** | Evidence ingestion from CI and reporting workflow can be added in a future iteration; current implementation supports programmatic validation and scoring | — | Future iteration |
| **Threshold weightings** | Exact go/no-go weights are an open decision (Plan §4.3); code uses defaults until frozen in Phase 0 | — | Phase 0 |

**Source:** [L2-99 Implementation Plan](L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md), [L2-99 Handoff](L2-99_Handoff.md).

---

## Master delivery plan / cross-cutting

| Gap | Impact / notes | Owner | Target |
|-----|----------------|-------|--------|
| **Internal transport** | Internal transport for future long-running jobs (HTTP-only now vs queue later) is an open decision | — | Deadline: before Plan 08 production rollout |
| **Harness gate criteria** | Task P0-03 – Approve deferred harness gate criteria (still to be done at master level) | — | Master level |

**Source:** [00_Master-Delivery-Plan.md](../00_Master-Delivery-Plan.md).

---

## Recommended next steps (in-repo gaps)

After updating this doc, the highest-impact next implementations (in order of impact vs effort) are:

1. **L2-05 – Secrets manager:** Replace the stub with env-based resolution (e.g. `SECRET_<key>_<scope>` or one JSON env) so real secrets can be wired per environment without changing the API.
2. **L2-06 – Grounding:** Add an optional grounding score threshold in synthesis so low-confidence retrieval can set a flag or disclaimer in the response.
3. **L2-04 – OTEL exporter (optional):** Implement `IEventSink` with an OTEL collector/exporter for backends that consume OTLP.

A new session can start with: *"Update Known-Gaps and then implement env-based secrets"* or *"Implement grounding threshold (L2-06)"* with minimal ambiguity.

---

## Verification commands (quick reference)

| Area | Key command(s) |
|------|-----------------|
| L2-01 | `npm run test`, `npm run lint`, `npm run typecheck` |
| L2-02 | See [L2-02 Implementation Plan](L2-02_MVP-Runtime-Single-Endpoint-Chat.md) |
| L2-03 | `npm test` (controlplane, query.integration.test.ts) |
| L2-04 | `npm run acceptance:observability`, `npm run eval`, `npm run eval:ci` |
| L2-05 | `npm test` (security/*.test.ts, gateways/tool-gateway.test.ts, abuse.test.ts) |
| L2-06 | `npm test` (memory/*.test.ts, retrieval.integration.test.ts) |
| L2-07 | `npm test` (ingress, brainstem, router, config/schema.test.ts) |
| L2-08 | `npm test`, `npm run build && node dist/bootstrap/index.js` |
| L2-99 | `npm test` (governance/*.test.ts, config/schema.test.ts) |
