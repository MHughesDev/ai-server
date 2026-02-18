# 11 FailureManager Spec

## Purpose
Classify failures and run standardized recovery actions.

## Taxonomy
`tool_timeout`, `tool_denied`, `model_error`, `budget_exceeded`, `unsafe_output`, `invalid_state`, `dependency_down`.

## Recovery
Bounded retry, provider fallback, strategy downgrade, async handoff, or structured abort.

## Guarantees
No infinite retries and consistent error envelopes.
