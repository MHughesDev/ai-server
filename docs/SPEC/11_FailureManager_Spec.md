# 11 Failure Manager Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 13, 16, 18.3, 18.9, 18.10).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

## Purpose
Provide deterministic failure classification and bounded recovery behavior across governance, workflow, and gateway failures.

## Failure Taxonomy
- `tool_timeout`, `tool_denied`.
- `model_error`, `provider_unavailable`.
- `budget_exceeded`, `deadline_exceeded`.
- `unsafe_output`, `policy_blocked`.
- `invalid_state`, `dependency_down`.

## Recovery Actions
- Retry with bounded attempts and backoff.
- Fallback model/provider or degrade strategy.
- Abort with structured error envelope and trace context.
- Async handoff only if async lifecycle is truly implemented.

## Guarantees
- No infinite retries.
- Retryability is error-class aware.
- Error mapping is deterministic and auditable.

## Production Requirements
- Timeout wrappers should avoid timer leaks/churn.
- Recovery actions must remain within policy and budget constraints.
