# 13 Router and Dispatch Spec

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Sections 9.3, 11, 16, 18.4, 18.10).
- Implementation status: `docs/CODEBASE-DOCS-VERIFICATION-REPORT.md` (verified features vs documentation).

## Purpose
Convert canonicalized request + intent + policy into a single workflow execution spec (`PipelinePlan`) or deterministic denial.

## Inputs
- `CanonicalRequest`, `IntentBundle`, `PolicyDecision`, and runtime/budget signals.

## Output
- `PipelinePlan` (`pipeline_type`, `strategy_id`, budgets, tools/memory settings, optional sandbox), where `pipeline_type` maps to workflow id in current implementation.
- Or deny with structured reason.

## Current Routing Priority (implementation)
1. `coding_agent` when policy allows and tool likelihood threshold is met.
2. `deep_research` when routing hints indicate research behavior.
3. `decision` when routing hints indicate recommendation/choice behavior.
4. `reactive_chat` fallback when allowed.
5. Deny when policy blocks or required capability is unavailable.

## Dispatch Rules
- Enforce policy allowlists and budget constraints before execution.
- Preserve tenant fairness and deterministic error mapping.
- Emit route and dispatch events for traceability.

## Execution Modes
- `sync_stream` (current and only supported mode in the v1 contract profile).
- `async_job` is intentionally not exposed until full async lifecycle support exists (queue, status, retrieval, idempotency).

## Current-State Notes
- ✅ Decision step routing IS implemented and operational (`src/workflows/runner.ts` lines 500-533)
  - Branch condition evaluation with comparison operators (>, >=, <, <=, ==, !=) (lines 42-100)
  - Target step resolution with default fallback (lines 105-124)
- ✅ Stop conditions ARE enforced centrally via workflow runner (`src/workflows/runner.ts` lines 328-374)
- ✅ Policy/workflow alignment IS implemented (`src/controlplane/policy-evaluator.ts`)
  - Default policy allows standard pipelines: `reactive_chat`, `coding_agent`, `deep_research`, `decision`
  - Policy gates block disallowed workflows before routing
- Async mode contracts defined but runtime is sync-only (accurately documented)
