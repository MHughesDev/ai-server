# 10 Execution Supervisor Spec

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Sections 3, 9.3, 16, 18.4).
- Implementation status: `docs/CODEBASE-DOCS-VERIFICATION-REPORT.md` (verified features vs documentation).

## Purpose
Monitor workflow execution and apply deterministic control interventions under policy and budget constraints.

## Inputs
- Workflow step events.
- Budget consumption and deadline signals.
- Tool/model/memory failure signals.
- Verification outputs.

## Interventions
- Pause or abort execution.
- Trigger fallback or downgrade strategy.
- Request replanning through orchestrator path.
- Enforce stop conditions (`max_iterations`, `deadline_ms`, policy blocks).

## Guarantees
- Interventions produce structured reason codes.
- Trace continuity is preserved across interventions and nested workflow calls.
- Supervisor does not generate user-facing answers.

## Production Requirements
- Stop conditions must be enforced centrally.
- Invalid workflow dependency graphs must be rejected before runtime.

## Current-State Notes
- ✅ Stop conditions ARE centrally enforced in workflow runner (`src/workflows/runner.ts`)
  - `max_iterations` enforced at workflow start (lines 328-350)
  - `deadline_ms` enforced during step execution (lines 352-363)
  - Additional `maxStepExecutions` guard prevents runaway execution (lines 364-374)
- ✅ Workflow dependency validation IS implemented (`src/contracts/workflow-definition.ts`)
  - Unknown dependency references are rejected (lines 72-83)
  - Decision branch targets are validated (lines 84-94)
  - Default target steps are validated (lines 95-102)
  - Cycle detection via DFS IS implemented (lines 105-142)
- Budget exceeded responses return structured `BUDGET_EXCEEDED` error with dimension details
