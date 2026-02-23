# 18 Observability Spec

## Purpose
End-to-end visibility across routing, execution, verification, and cost.

## Required Events
`ROUTE_DECISION`, `POLICY_DECISION`, `BUDGET_ASSIGN`, `PIPELINE_START/END`, `TOOL_START/END`, `MEMORY_QUERY/WRITE`, `VERIFY_RESULT`, `FINAL_SYNTH`, `ERROR`.

Implementation: Event schema and taxonomy are defined in `src/observability/events.ts`; emitters apply redaction per `src/observability/redact.ts`. See L2-04 Implementation Summary.

## Signals
Traces, metrics, structured logs, and optional event stream. Trace context (`trace_id`, `request_id`) is propagated via `src/observability/context.ts`. Metrics are exposed at `GET /metrics` with cardinality-controlled labels. **Long-term retention:** set an optional event sink via `setEventSink` (e.g. `createFileEventSink(path)`); enable with `OBSERVABILITY_EVENT_SINK_PATH`. Events are written after sampling and redaction (one JSON line per event, NDJSON). Custom sinks (e.g. OTEL exporter) can implement `IEventSink`.

## Privacy
Policy-driven redaction and no raw secret logging. Redaction levels: none, minimal, full (allowlist in `src/observability/redact.ts`).
