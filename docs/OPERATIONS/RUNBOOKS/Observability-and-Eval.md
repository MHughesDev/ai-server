# Observability and Evaluation Runbook (L2-04)

Runbook for telemetry, metrics, alerts, and evaluation regression. Owner: Observability Lead; escalation: SRE → Runtime → Security.

## Source Alignment

- Normative production requirements: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 13 and 18.8).
- Current implementation deltas/gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

Use this runbook for current operations, and track open hardening work (sink durability, retention, sampling, cardinality controls) against the gaps report.

---

## Missing telemetry / required events

### Symptom

- Trace or event coverage below expected (if using external dashboards, they may show gaps).
- Required events (SPEC 18): `ROUTE_DECISION`, `POLICY_DECISION`, `BUDGET_ASSIGN`, `PIPELINE_START`/`PIPELINE_END`, `WORKFLOW_START`/`WORKFLOW_END`, `ENGINE_START`/`ENGINE_END`, `ERROR`, `FINAL_SYNTH` (and `TOOL_*`, `MEMORY_*` when those paths run).

### Actions

1. Confirm feature flag: `OBSERVABILITY_REQUIRED_EVENTS_V1` is not `false` in env (see `src/config/schema.ts`).
2. Check that `setObservability()` is called at startup when the flag is true (`src/server/index.ts`).
3. Run event coverage tests: `npm run test -- --testPathPattern=observability`.
4. If a new code path was added, wire event emission at the appropriate boundary (policy, router, pipeline) using `getObservability()?.events.emit(...)`.

### Verification

- Trigger a request to `POST /v1/query` and confirm in logs (or captured events) that POLICY_DECISION, BUDGET_ASSIGN, ROUTE_DECISION, PIPELINE_START, WORKFLOW_START, ENGINE_START, ENGINE_END (×2 for reactive chat), WORKFLOW_END, PIPELINE_END, FINAL_SYNTH are present for success path.
- Run the observability acceptance suite: `npm run acceptance:observability` (validates event taxonomy, redaction, trace context, metrics, event order / span hierarchy, eval baseline).

---

## File sinks (audit + events)

### Production startup checks (WANT-039)

When `NODE_ENV=production` and **`AUDIT_LOG_PATH`** and/or **`OBSERVABILITY_EVENT_SINK_PATH`** are set, bootstrap **throws** if the **parent directory** is missing or not writable, or if an **existing** sink file is not writable. Create the directory (and set ownership/permissions) **before** first deploy.

### Durability vs performance (WANT-040 follow-on)

- Default: queued **async** `appendFile` writes (no per-line fsync).
- Stricter durability: set **`AUDIT_LOG_FSYNC=true`** and/or **`OBSERVABILITY_EVENT_SINK_FSYNC=true`** to `fsync` after each append (high latency; use only when policy requires it).

### On-disk audit integrity

- Programmatic check for a single NDJSON audit file: **`verifyAuditLogFileIntegrity(path)`** in `src/security/audit-logger.ts` (hash chain per line). Run per rotated segment (`.1`, `.2`, …) or merge files for a full history review.

### Graceful shutdown

- On **`SIGINT`/`SIGTERM`**, the server drains active connections (see `SHUTDOWN_DRAIN_TIMEOUT_MS`), then flushes **audit** and **event** file sink queues before exit (`src/server/index.ts`). For stricter durability under kill `-9`, use **`AUDIT_LOG_FSYNC`** / **`OBSERVABILITY_EVENT_SINK_FSYNC`** or external log shipping.

---

## Alert false positives / tuning

### Symptom

- Alerts fire frequently without real incidents; team fatigue.

### Actions

1. Review alert definitions (see **Alert definitions** below). Prefer burn-rate or sustained-window conditions over single-point thresholds.
2. Add suppression windows for known maintenance or deployment windows if supported by your alert backend.
3. Demote low-value rules to warning tier or disable until thresholds are recalibrated with baseline data.
4. Document any threshold change in this runbook and in the L2-04 plan.

### Escalation

- Observability Lead for threshold and rule ownership.

---

## Eval regression triage

### Symptom

- `npm run eval` exits 1; or CI step `eval:ci` (eval harness tests) fails.

### Actions

1. Run locally: `npm run eval` (baseline) or `npm run test -- --testPathPattern=eval/runner`.
2. Inspect output: which `case_id` failed and whether `status_match`, `latency_ok`, or `pipeline_match` is false.
3. If a contract or routing change intentionally changes status or pipeline: update `src/eval/baseline.json` (or the failing case) to reflect new expected status/pipeline; add a short comment in the dataset.
4. If latency regressed: increase `max_latency_ms` for that case only after confirming no real performance regression; otherwise fix the regression first.
5. If failure is flaky: add retries or relax timing in the harness; avoid over-tight thresholds.

### CI gate

- To block PRs on eval regression: add a CI job that runs `npm run eval` (or `npm run eval:ci`) and fails the build on non-zero exit.

### Verification

- After changing baseline or code, run `npm run eval` and ensure 2/2 (or N/N) passed.

---

## Alert definitions (reference)

Use these as a reference when configuring your alert backend (e.g. Prometheus/Grafana). Exact rule syntax is backend-specific.

| Alert | Condition | Severity | Owner |
|-------|-----------|----------|--------|
| Error budget burn | Error rate or failed requests above threshold over window | High | SRE |
| Latency degradation | p95 latency above SLO (e.g. 2x baseline) for 5m | High | SRE |
| Missing required events | Event coverage rate below 95% over 15m | Medium | Observability |
| Cost spike | Cost-by-route or total cost above budget threshold | Medium | SRE / Runtime |
| Governance deny spike | POLICY_DECISION deny rate or ROUTE_DECISION deny rate spike | Medium | Control Plane |

### SLO targets (L2-04)

- Telemetry overhead: &lt; 5% p95 increase.
- Telemetry pipeline drop rate: &lt; 0.1%.
- Observability stack within approved monthly telemetry budget.

---

## GET /metrics

- Endpoint: `GET /metrics`.
- **Default (JSON):** Returns `{ counters: Record<string, number>, histograms: Record<string, { count, sum }> }`. Metric names: `requests_total`, `errors_total`, `request_latency_ms`, `route_total`, etc. Labels are allowlisted to control cardinality.
- **Prometheus format:** Use `GET /metrics?format=prometheus` or `Accept: text/plain` to get Prometheus exposition text (`# TYPE`, counter and summary-style metrics) for scraping by Prometheus or compatible backends.

---

## Escalation

- **Alert owner:** SRE on-call, secondary Runtime.
- **Path:** SRE → Runtime → Security (for data leakage or audit concerns).
