# 18 Observability Spec

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Section 13 and Section 18.8).
- Current-state gaps: `docs/Production-Readiness-Gaps-Report.md` (event retention, sink durability/backpressure, sampling, bounded cardinality).

## Purpose
Provide end-to-end traceability for governance decisions, workflow execution, costs, and failures.

## Required Event Taxonomy
- `ROUTE_DECISION`
- `POLICY_DECISION`
- `BUDGET_ASSIGN`
- `PIPELINE_START` / `PIPELINE_END`
- `WORKFLOW_START` / `WORKFLOW_END`
- `ENGINE_START` / `ENGINE_END`
- `TOOL_START` / `TOOL_END`
- `MEMORY_QUERY` / `MEMORY_WRITE`
- `VERIFY_RESULT`
- `FINAL_SYNTH`
- `ERROR`
- `HARNESS_ITERATION` (when autonomous harness loop is enabled)

## Signal Types
- Tracing (trace_id continuity).
- Metrics (latency, throughput, errors, cost).
- Structured logs (redacted).
- Event stream/sink for retention and replay use cases.

## `/metrics` Behavior
- Default JSON response for counters/histograms.
- Prometheus exposition when `Accept: text/plain` or `?format=prometheus`.

## Privacy and Redaction
- Redaction level is policy-driven and applied before log/event/audit sink writes.
- Raw secrets are never emitted.

## Production Requirements
- Event/audit sinks are non-blocking and operationally bounded.
- Sink settings are config-validated before serving production traffic.
- Metrics/cardinality and in-memory capture buffers are bounded for long-running services.
