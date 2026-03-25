# 08 Strategy Engine Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 3, 9.3, 11, 16).
- Implementation status: `docs/CODEBASE-DOCS-VERIFICATION-REPORT.md` (verified features vs documentation).

## Purpose
Select workflow strategy using intent, complexity, risk, capability needs, policy constraints, and runtime signals.

## Inputs
- `IntentBundle`.
- `PolicyDecision`.
- Runtime constraints (budget pressure, dependency health, rollout flags).

## Outputs
- `pipeline_type` (workflow id in current implementation).
- `strategy_id`.
- Verification level / strictness.
- Optional fallback strategy.

## Strategy Rules
- Strategy selection is modality-agnostic; modality is an input property, not a workflow type.
- High-risk or low-confidence requests should route to stricter verification paths.
- Strategy cannot violate policy or assigned budgets.

## Current Workflow Set
- `reactive_chat`, `coding_agent`, `deep_research`, `decision`, `tool_automation`, `extraction`, `verification`, `planning_only`, `batch_analysis`.

## Production Requirements
- Strategy decisions must be observable and reproducible from decision artifacts.
- Unsupported async paths must not be advertised as fully available until lifecycle semantics exist.

## Current-State Notes
- ✅ Strategy selection via default router IS implemented (`src/router/default-router.ts`)
- ✅ All 9 workflows are registered and available (`src/workflows/registry.ts` lines 16-231)
- ✅ Decision step routing IS implemented for recommendation/choice behavior (`src/workflows/runner.ts` lines 500-533)
- ✅ Workflow graph execution with topological ordering IS implemented (`src/workflows/runner.ts` lines 130-149)
- Async mode strategy is contract-defined but sync-only runtime (accurately documented)
