# L2-04 Sprint Handoff – Observability and Evaluation

**Plan:** L2-04 Observability and Evaluation Implementation  
**Status:** Implementation complete  
**Handoff to:** L2-05 Security Isolation and Compliance, L2-06 Memory and Retrieval  

---

## 1) L2-05 / L2-06 start checklist

- [x] Canonical event schema and emitters (POLICY_DECISION, BUDGET_ASSIGN, ROUTE_DECISION, PIPELINE_START/END, FINAL_SYNTH, ERROR)
- [x] Redaction utility integrated in telemetry pipeline (minimal/full levels)
- [x] Trace context propagation (request_id, trace_id) via AsyncLocalStorage; runWithContextAsync / getTraceContext
- [x] Core metrics (counters and histograms) with cardinality guardrails; GET /metrics
- [x] Evaluation harness and baseline gold dataset; npm run eval, eval:ci
- [x] Regression gate in CI (eval runner tests)
- [x] Alert definitions and escalation documented in runbook
- [x] Final observability acceptance suite (npm run acceptance:observability)
- [x] Feature flag: observability_required_events_v1 (default true)
- [ ] Readiness review meeting (owner sign-off)
- [ ] L2-05 / L2-06 implementation start

**Definition of ready for L2-05 / L2-06:** All items above except the review meeting are done. Downstream plans can rely on event contracts, trace context, metrics, and eval baseline.

---

## 2) Event and telemetry contracts

Events are emitted when `observability_required_events_v1` is true. Payloads are redacted per config.

| Event | When emitted | Key payload fields |
|-------|----------------|---------------------|
| POLICY_DECISION | After control plane policy eval | allowed, deny_reason, memory_scope, allowed_pipelines |
| BUDGET_ASSIGN | After policy (and budget check) | token_budget, tool_budget, deadline_ms, cost_budget_usd |
| ROUTE_DECISION | After router | deny, deny_reason or pipeline_type, strategy_id |
| PIPELINE_START | Before pipeline run | pipeline_type, strategy_id |
| PIPELINE_END | After pipeline run | pipeline_type, strategy_id, duration_ms, status |
| FINAL_SYNTH | After response synthesis | pipeline_type, status |
| ERROR | On deny or failure | code, message, stage, detail_redacted |

**Trace context:** Use `createContext(requestId, traceId?)` and `runWithContextAsync(ctx, async () => { ... })`. Inside the callback, `getTraceContext()` returns `{ request_id, trace_id }`. Emit events via `getObservability()?.events.emit(event)` so request_id/trace_id are attached.

---

## 3) Metrics (GET /metrics)

- **Counters:** requests_total, errors_total, route_total, security_deny_total, retrieval_*, attachment_reject_total (L2-07)
- **Histograms:** request_latency_ms, audit_write_latency_ms, retrieval_latency_ms  
- Label allowlist enforced: route, pipeline_type, status, error_code, env, reason, event_type

---

## 4) Eval and acceptance

- **Baseline:** `src/eval/baseline.json` – gold cases with expected_status, max_latency_ms, expected_pipeline
- **CLI:** `npm run eval` (tsx run-eval.ts); **CI:** `npm run eval:ci` (Jest eval/runner.test)
- **Observability acceptance:** `npm run acceptance:observability` – event taxonomy, redaction, trace context, metrics, eval baseline, context propagation

---

## 5) Config and feature flags

- **observability_required_events_v1**  
  Default: true. Env: `OBSERVABILITY_REQUIRED_EVENTS_V1=false` to disable.  
  When true: required governance and lifecycle events are emitted; trace context and metrics are populated.

---

## 6) Known gaps (see Gate Report)

- Dashboard panels are out of scope for this repo (UI-less server); deferred to ops/external tooling.
- Alert simulation drill in staging when telemetry stack available (P3-03).
- Production trace sampling strategy TBD before L2-08.
- Event retention: in-memory/capture only; persistent sink per environment.

---

## 7) CI and verification

| Check | Command / location |
|-------|---------------------|
| Observability acceptance | `npm run acceptance:observability` |
| Observability unit tests | `npm test -- --testPathPattern=observability` |
| Eval harness | `npm run eval` or `npm run eval:ci` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |

---

## 8) References

- Gate report and known gaps: `docs/PLANS/Implementation-plans/L2-04_Gate-Report-and-Known-Gaps.md`
- Event schema and redaction: `src/observability/events.ts`, `redact.ts`, `emitter.ts`
- Trace context: `src/observability/context.ts`
- Metrics: `src/observability/metrics.ts`
- Eval: `src/eval/runner.ts`, `baseline.json`, `run-eval.ts`
- Runbook: `docs/Runbooks/Observability-and-Eval.md` or `docs/Runbooks/Observability-and-Eval.md`
