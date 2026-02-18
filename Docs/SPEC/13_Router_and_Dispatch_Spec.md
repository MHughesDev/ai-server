# 13 Router and Dispatch Spec

## Purpose
Map `PipelinePlan` to runtime execution path and worker class.

## Modes
`sync_stream` and `async_job`.

## Rules
Priority-aware dispatch, tenant fairness, cancellation semantics, and lifecycle event emission.
