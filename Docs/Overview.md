# Documentation Overview

## Authoritative Sources
- **Architecture target state:** `Architecture_document_Finalized.md` (Section 18 is normative for production requirements).
- **Current implementation status and remaining work:** `Production-Readiness-Gaps-Report.md` (single source of truth for production readiness state).
- **Deployment and launch runbook:** `Production-Deployment-Guide.md` (canonical deploy/launch checklist).
- **Implementation-grounded runtime map:** `World-Model-Codebase.md` (best quick orientation for how `src/` behaves today).

This file is an index and orientation document. The detailed normative specs live in `SPEC/` and the operational procedures live in `Runbooks/`.

## How To Read the Docs
1. Start with `World-Model-Codebase.md` for the current runtime map in `src/`.
2. Read `Architecture_document_Finalized.md` for system intent, layer model, and target-state rules.
3. Read `Production-Readiness-Gaps-Report.md` for current implementation status and open gaps.
4. Read `Production-Deployment-Guide.md` for production setup, hardening, validation, and rollout.
5. Use `SPEC/00` through `SPEC/22` for component-level contract and behavior details.
6. Use `Runbooks/` for on-call triage, release/rollback, and operational handling.

## Cleanup Notes
- Deprecated duplicate planning/handoff/prompt files were removed to reduce documentation drift.
- Status tracking is centralized in `Production-Readiness-Gaps-Report.md`.
- Deployment execution checklists are centralized in `Production-Deployment-Guide.md`.

## Core Architecture Model
- **Layer 1:** Model primitives.
- **Layer 2:** Engines.
- **Layer 3:** Workflows.
- **Layer 4:** Orchestration and governance (Ingress + Brain Stem + policy/budget/route/supervision).

## Key Invariants
- Ingress is deterministic and non-cognitive.
- Cognition begins at Brain Stem.
- Orchestrator enforces policy and budgets and is the only control authority for loops/retries/nesting.
- Tool and memory access are gateway-only.
- Every request is traceable with governance and execution telemetry.

## SPEC Index
- `SPEC/00_System_Overview.md`
- `SPEC/01_Principles_and_Invariants.md`
- `SPEC/02_API_Contracts.md`
- `SPEC/03_Component_Map.md`
- `SPEC/04_Ingress_Spec.md`
- `SPEC/05_BrainStem_Spec.md`
- `SPEC/06_ControlPlane_Spec.md`
- `SPEC/07_PolicyEngine_Spec.md`
- `SPEC/08_StrategyEngine_Spec.md`
- `SPEC/09_ResourceManager_Spec.md`
- `SPEC/10_ExecutionSupervisor_Spec.md`
- `SPEC/11_FailureManager_Spec.md`
- `SPEC/12_EvaluationEngine_Spec.md`
- `SPEC/13_Router_and_Dispatch_Spec.md`
- `SPEC/14_Pipelines_Catalog.md`
- `SPEC/15_ModelGateway_Spec.md`
- `SPEC/16_ToolGateway_Spec.md`
- `SPEC/17_MemoryAbstraction_Spec.md`
- `SPEC/18_Observability_Spec.md`
- `SPEC/19_Security_and_Isolation_Spec.md`
- `SPEC/20_Config_and_FeatureFlags.md`
- `SPEC/21_Test_and_Eval_Plan.md`
- `SPEC/22_Runbooks_and_Operations.md`

## Runbook Index
- `Runbooks/Query-and-Policy-Failures.md`
- `Runbooks/Release-and-Rollback.md`
- `Runbooks/Multimodal-Input-Path.md`
- `Runbooks/Memory-Retrieval-Outage.md`
- `Runbooks/Observability-and-Eval.md`
- `Runbooks/Harness-Readiness-Gate.md`
- `Runbooks/CI-Bootstrap-Troubleshooting.md`
