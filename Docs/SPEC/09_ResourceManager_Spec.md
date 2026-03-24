# 09 Resource Manager Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 8.3, 9.3, 18.3).
- Implementation status: `docs/CODEBASE-DOCS-VERIFICATION-REPORT.md` (verified features vs documentation).

## Purpose
Translate policy maxima into effective request budgets and enforce bounded execution behavior.

## Budget Dimensions
- `deadline_ms`.
- `token_budget`.
- `tool_budget`.
- `cost_budget_usd`.
- `max_parallel_tools` (where supported by workflow runtime).

## Responsibilities
- Compute effective budgets from policy + request + system state.
- Enforce request deadline propagation.
- Apply backpressure and admission control.
- Support per-tenant fairness and concurrency controls.

## Production Requirements
- Deadlines and cost caps must be enforced during execution, not only assigned.
- Cross-request tenant usage controls must use shared/persistent counters.
- Budget accounting failures should fail-soft unless policy requires hard-fail.

## Current-State Notes
- ✅ Budget computation IS implemented (`src/controlplane/resource-manager.ts`)
- ✅ Tenant budget with multi-backend support IS implemented (`src/controlplane/tenant-budget.ts`)
  - In-memory backend (lines 23-38)
  - File backend (lines 40-70)
  - Redis/Upstash backend (lines 72-108)
- ✅ Hourly cost cap enforcement IS implemented (`src/controlplane/tenant-budget.ts` lines 170-180)
- ✅ Budget usage recording IS implemented (`src/controlplane/tenant-budget.ts` lines 145-165)
- Budget fields are computed at request time and enforced during workflow execution
