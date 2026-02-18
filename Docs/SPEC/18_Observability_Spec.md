# 18 Observability Spec

## Purpose
End-to-end visibility across routing, execution, verification, and cost.

## Required Events
`ROUTE_DECISION`, `POLICY_DECISION`, `BUDGET_ASSIGN`, `PIPELINE_START/END`, `TOOL_START/END`, `MEMORY_QUERY/WRITE`, `VERIFY_RESULT`, `FINAL_SYNTH`, `ERROR`.

## Signals
Traces, metrics, structured logs, and optional event stream.

## Privacy
Policy-driven redaction and no raw secret logging.
