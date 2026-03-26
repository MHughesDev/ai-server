# 18 Observability Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Section 13 and Section 18.8).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` (event retention, sink durability/backpressure, sampling, bounded cardinality).

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

**As-built (2026-03-25):** **`VERIFY_RESULT`** is emitted from **`src/engines/evaluation_engine.ts`** on each evaluation invoke (pass/fail, score, duration). **`MEMORY_WRITE`** is emitted from **`src/memory/in-memory-store.ts`** and **`src/memory/vector-retrieval-adapter.ts`** on ingest outcomes (counts, scope, errors; no document body). **`MEMORY_QUERY`** is emitted from **`src/memory/retrieval-service.ts`** via **`emitMemoryQueryEvent`** on every completed **`runRetrieval`** (payload: `hit_count`, `latency_ms`, `scope`, `degraded`; includes degraded empty-hit paths). When **`runRetrieval`** throws (e.g. memory engine path), **`emitMemoryQueryEvent`** may include **`error`** (message only). Helpers: **`src/observability/taxonomy-events.ts`**.

**As-built (2026-03-24):**
- **Metrics:** `src/observability/metrics.ts` caps counter series (`MAX_COUNTER_SERIES`), histogram series, and per-series samples; exposes drop counts as `ai_server_metrics_dropped_total{dimension=…}` in Prometheus text; optional `exportAndResetCounters()` for counter scrape+reset.
- **Emitter capture:** `createEmitter` uses `maxCaptureSize` (default 1000) with FIFO eviction (`emitter.ts`).
- **Event/audit file sinks:** async `appendFile` + bounded queues + rotation (`event-sink.ts`, `audit-logger.ts`). **Production:** `assertProductionSinkPathsWritable` in bootstrap when paths are set (`sink-paths.ts`). Optional **`AUDIT_LOG_FSYNC`** / **`OBSERVABILITY_EVENT_SINK_FSYNC`** → per-append `fsync` (`sync-file-to-disk.ts`). **Shutdown:** `SIGINT`/`SIGTERM` — drain audit file queue via **`shutdownPersistentAuditFileSink`**, then **`IEventSink.close()`** for the event file sink (`server/index.ts`).
