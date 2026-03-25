# Documentation Overview

## Authoritative sources (repo paths)

- **Architecture target state:** [`Architecture_document_Finalized.md`](./Architecture_document_Finalized.md) (Section 18 is normative for production requirements).
- **Current implementation status and remaining work:** [`../OPERATIONS/Production-Readiness-Gaps-Report.md`](../OPERATIONS/Production-Readiness-Gaps-Report.md).
- **Deployment and launch runbook:** [`../OPERATIONS/Production-Deployment-Guide.md`](../OPERATIONS/Production-Deployment-Guide.md).
- **Implementation-grounded runtime map:** [`../REFERENCE/World-Model-Codebase.md`](../REFERENCE/World-Model-Codebase.md).
- **Agent bootstrap:** [`../START-HERE.md`](../START-HERE.md).

This file is an index and orientation document. Normative component specs live in [`../SPEC/`](../SPEC/). Operational runbooks live in [`../OPERATIONS/RUNBOOKS/`](../OPERATIONS/RUNBOOKS/).

## How to read the docs

1. Start with [`../REFERENCE/World-Model-Codebase.md`](../REFERENCE/World-Model-Codebase.md) for the current runtime map in `src/`.
2. Read [`Architecture_document_Finalized.md`](./Architecture_document_Finalized.md) for system intent, layer model, and target-state rules.
3. Read [`../OPERATIONS/Production-Readiness-Gaps-Report.md`](../OPERATIONS/Production-Readiness-Gaps-Report.md) for current implementation status and open gaps.
4. Read [`../OPERATIONS/Production-Deployment-Guide.md`](../OPERATIONS/Production-Deployment-Guide.md) for production setup, hardening, validation, and rollout.
5. Use `docs/SPEC/00` through `docs/SPEC/22` for component-level contract and behavior details.
6. Use [`../OPERATIONS/RUNBOOKS/`](../OPERATIONS/RUNBOOKS/) for on-call triage, release/rollback, and operational handling.

## Cleanup notes

- Deprecated duplicate planning/handoff files were removed to reduce documentation drift where noted in plans.
- Status tracking is centralized in [`../OPERATIONS/Production-Readiness-Gaps-Report.md`](../OPERATIONS/Production-Readiness-Gaps-Report.md).
- Deployment execution checklists are centralized in [`../OPERATIONS/Production-Deployment-Guide.md`](../OPERATIONS/Production-Deployment-Guide.md).

## Core architecture model

- **Layer 1:** Model primitives.
- **Layer 2:** Engines.
- **Layer 3:** Workflows.
- **Layer 4:** Orchestration and governance (Ingress + Brain Stem + policy/budget/route/supervision).

## Key invariants

- Ingress is deterministic and non-cognitive.
- Cognition begins at Brain Stem.
- Orchestrator enforces policy and budgets and is the only control authority for loops/retries/nesting.
- Tool and memory access are gateway-only.
- Every request is traceable with governance and execution telemetry.

## SPEC index

Paths are under `docs/SPEC/`:

- `00_System_Overview.md` … `22_Runbooks_and_Operations.md` (see folder listing).

## Runbook index

Paths are under `docs/OPERATIONS/RUNBOOKS/`:

- `Query-and-Policy-Failures.md`
- `Release-and-Rollback.md`
- `Multimodal-Input-Path.md`
- `Memory-Retrieval-Outage.md`
- `Observability-and-Eval.md`
- `Harness-Readiness-Gate.md`
- `CI-Bootstrap-Troubleshooting.md`
- `Alert-Canary-Failure.md`
- `Alert-Health-Check-Degradation.md`
- `Deployment-Runbook.md`
- `Infrastructure-as-Code-Examples.md`
