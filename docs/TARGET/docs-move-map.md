# Docs Move Map (Old -> New)

**Executed in repo:** 2026-03-24 — files moved under `docs/` per tables below; links bulk-updated. Use this file as audit trail and for any straggler fixes.

**Directory casing (Git, 2026-03-24):** The repository root folder is **`docs/`** (lowercase). Renamed from `Docs/` via two-step `git mv` so Linux/macOS case-sensitive checkouts match all links.

**Purpose:** Executable manifest for migrating documentation into the AI-agent-optimized structure.

**Canonical rule:** Use **`docs/`** (lowercase) only. The move-map tables below still show **`Docs/...`** in the left column as the historical source path before consolidation.

**Scope:** Markdown docs only (`*.md`). `openapi.yaml` remains at repo root.

---

## 1) Core migration rules

1. Move every `Docs/...` markdown file into `docs/...` using the mapped destination below.
2. If a file already exists at destination, merge content and keep one canonical file.
3. After moves, update links in `README.md`, `AGENTS.md`, and docs to point to canonical paths.
4. Keep `openapi.yaml` at repo root; do not move under `docs/`.

---

## 2) File-by-file move map

### 2.1 Architecture and reference

| Old path | New path |
|---|---|
| `docs/ARCHITECTURE/Architecture_document_Finalized.md` | `docs/ARCHITECTURE/Architecture_document_Finalized.md` |
| `docs/ARCHITECTURE/Overview.md` | `docs/ARCHITECTURE/Overview.md` |
| `docs/REFERENCE/Newcomer-How-The-Server-Works.md` | `docs/REFERENCE/Newcomer-How-The-Server-Works.md` |
| `docs/REFERENCE/World-Model-Codebase.md` | `docs/REFERENCE/World-Model-Codebase.md` |
| `docs/REFERENCE/Engines-and-Contracts.md` | `docs/REFERENCE/Engines-and-Contracts.md` |
| `docs/REFERENCE/schemas/schema-ref-catalog.md` | `docs/REFERENCE/schemas/schema-ref-catalog.md` |

### 2.2 Target docs

| Old path | New path |
|---|---|
| `Docs/TARGET/Target-State-Backlog.md` | **Removed 2026-05-20** — merged into repo root `to-do.md` §2 |
| `docs/TARGET/Documentation-Finalization-Plan.md` | **Removed 2026-05-20** — merged into `to-do.md` §7 |

### 2.3 Operations and runbooks

| Old path | New path |
|---|---|
| `docs/OPERATIONS/Production-Deployment-Guide.md` | `docs/OPERATIONS/Production-Deployment-Guide.md` |
| `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` | `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` |
| `docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md` | `docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md` |
| `docs/OPERATIONS/RUNBOOKS/Alert-Canary-Failure.md` | `docs/OPERATIONS/RUNBOOKS/Alert-Canary-Failure.md` |
| `docs/OPERATIONS/RUNBOOKS/Alert-Health-Check-Degradation.md` | `docs/OPERATIONS/RUNBOOKS/Alert-Health-Check-Degradation.md` |
| `docs/OPERATIONS/RUNBOOKS/CI-Bootstrap-Troubleshooting.md` | `docs/OPERATIONS/RUNBOOKS/CI-Bootstrap-Troubleshooting.md` |
| `docs/OPERATIONS/RUNBOOKS/Deployment-Runbook.md` | `docs/OPERATIONS/RUNBOOKS/Deployment-Runbook.md` |
| `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md` | `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md` |
| `docs/OPERATIONS/RUNBOOKS/Infrastructure-as-Code-Examples.md` | `docs/OPERATIONS/RUNBOOKS/Infrastructure-as-Code-Examples.md` |
| `docs/OPERATIONS/RUNBOOKS/Memory-Retrieval-Outage.md` | `docs/OPERATIONS/RUNBOOKS/Memory-Retrieval-Outage.md` |
| `docs/OPERATIONS/RUNBOOKS/Multimodal-Input-Path.md` | `docs/OPERATIONS/RUNBOOKS/Multimodal-Input-Path.md` |
| `docs/OPERATIONS/RUNBOOKS/Observability-and-Eval.md` | `docs/OPERATIONS/RUNBOOKS/Observability-and-Eval.md` |
| `docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md` | `docs/OPERATIONS/RUNBOOKS/Query-and-Policy-Failures.md` |
| `docs/OPERATIONS/RUNBOOKS/Release-and-Rollback.md` | `docs/OPERATIONS/RUNBOOKS/Release-and-Rollback.md` |

### 2.4 SPEC docs

| Old path | New path |
|---|---|
| `Docs/SPEC/00_System_Overview.md` | `docs/SPEC/00_System_Overview.md` |
| `Docs/SPEC/01_Principles_and_Invariants.md` | `docs/SPEC/01_Principles_and_Invariants.md` |
| `Docs/SPEC/02_API_Contracts.md` | `docs/SPEC/02_API_Contracts.md` |
| `Docs/SPEC/03_Component_Map.md` | `docs/SPEC/03_Component_Map.md` |
| `Docs/SPEC/04_Ingress_Spec.md` | `docs/SPEC/04_Ingress_Spec.md` |
| `Docs/SPEC/05_BrainStem_Spec.md` | `docs/SPEC/05_BrainStem_Spec.md` |
| `Docs/SPEC/06_ControlPlane_Spec.md` | `docs/SPEC/06_ControlPlane_Spec.md` |
| `Docs/SPEC/07_PolicyEngine_Spec.md` | `docs/SPEC/07_PolicyEngine_Spec.md` |
| `Docs/SPEC/08_StrategyEngine_Spec.md` | `docs/SPEC/08_StrategyEngine_Spec.md` |
| `Docs/SPEC/09_ResourceManager_Spec.md` | `docs/SPEC/09_ResourceManager_Spec.md` |
| `Docs/SPEC/10_ExecutionSupervisor_Spec.md` | `docs/SPEC/10_ExecutionSupervisor_Spec.md` |
| `Docs/SPEC/11_FailureManager_Spec.md` | `docs/SPEC/11_FailureManager_Spec.md` |
| `Docs/SPEC/12_EvaluationEngine_Spec.md` | `docs/SPEC/12_EvaluationEngine_Spec.md` |
| `Docs/SPEC/13_Router_and_Dispatch_Spec.md` | `docs/SPEC/13_Router_and_Dispatch_Spec.md` |
| `Docs/SPEC/14_Pipelines_Catalog.md` | `docs/SPEC/14_Pipelines_Catalog.md` |
| `Docs/SPEC/15_ModelGateway_Spec.md` | `docs/SPEC/15_ModelGateway_Spec.md` |
| `Docs/SPEC/16_ToolGateway_Spec.md` | `docs/SPEC/16_ToolGateway_Spec.md` |
| `Docs/SPEC/17_MemoryAbstraction_Spec.md` | `docs/SPEC/17_MemoryAbstraction_Spec.md` |
| `Docs/SPEC/18_Observability_Spec.md` | `docs/SPEC/18_Observability_Spec.md` |
| `Docs/SPEC/19_Security_and_Isolation_Spec.md` | `docs/SPEC/19_Security_and_Isolation_Spec.md` |
| `Docs/SPEC/20_Config_and_FeatureFlags.md` | `docs/SPEC/20_Config_and_FeatureFlags.md` |
| `Docs/SPEC/21_Test_and_Eval_Plan.md` | `docs/SPEC/21_Test_and_Eval_Plan.md` |
| `Docs/SPEC/22_Runbooks_and_Operations.md` | `docs/SPEC/22_Runbooks_and_Operations.md` |

### 2.5 Plans (top-level)

| Old path | New path |
|---|---|
| `Docs/PLANS/00_Master-Delivery-Plan.md` | **Removed 2026-05-20** — phase tasks in `to-do.md` §10; L2 mapping: `docs/PLANS/implementation/L2-*_*.md` |
| `Docs/PLANS/01_Platform-Foundation-and-Contracts.md` … `99_Deferred-…` | **Removed (2026-03-29):** Draft plans duplicated L2 implementation series. |
| `Docs/PLANS/Scope-of-Work.md` | `docs/PLANS/Scope-of-Work.md` |
| `Docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` | **Removed 2026-05-20** — `to-do.md` §3 |
| `Docs/PLANS/Cleanup-and-Finalization-Checklist.md` | **Removed 2026-05-20** — `to-do.md` §6–§7 |
| `Docs/PLANS/PLAN_TEMPLATE.md` | `docs/PLANS/PLAN_TEMPLATE.md` |

### 2.6 Plans implementation docs

| Old path | New path |
|---|---|
| `docs/PLANS/implementation/Agent-3-*.md` | **Removed (2026-03-29):** Consolidated into `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` §11 and SPECs 10, 15, 16. |
| `docs/PLANS/implementation/L2-*_Handoff.md` | **Removed (2026-03-29):** Merged into each parent `L2-*_*Implementation*.md` under **§14–§15 Sprint handoff archive** (L2-04 also §15). |
| `docs/PLANS/implementation/L2-01_Contracts-and-Project-Scaffold.md` | `docs/PLANS/implementation/L2-01_Contracts-and-Project-Scaffold.md` |
| `docs/PLANS/implementation/L2-02_MVP-Runtime-Single-Endpoint-Chat.md` | `docs/PLANS/implementation/L2-02_MVP-Runtime-Single-Endpoint-Chat.md` |
| `docs/PLANS/implementation/L2-03_Policy-Budgeting-and-Routing-Implementation.md` | `docs/PLANS/implementation/L2-03_Policy-Budgeting-and-Routing-Implementation.md` |
| `docs/PLANS/implementation/L2-04_Gate-Report-and-Known-Gaps.md` | **Removed 2026-05-20** — `to-do.md` §6 |
| `docs/PLANS/implementation/L2-04_Observability-and-Evaluation-Implementation.md` | `docs/PLANS/implementation/L2-04_Observability-and-Evaluation-Implementation.md` |
| `docs/PLANS/implementation/L2-05_Security-Isolation-and-Compliance-Implementation.md` | `docs/PLANS/implementation/L2-05_Security-Isolation-and-Compliance-Implementation.md` |
| `docs/PLANS/implementation/L2-06_Memory-and-Retrieval-Implementation.md` | `docs/PLANS/implementation/L2-06_Memory-and-Retrieval-Implementation.md` |
| `docs/PLANS/implementation/L2-07_Multimodal-Input-Path-Implementation.md` | `docs/PLANS/implementation/L2-07_Multimodal-Input-Path-Implementation.md` |
| `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md` | `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md` |
| `docs/PLANS/implementation/L2-99_Decision-Memo-Template.md` | `docs/PLANS/implementation/L2-99_Decision-Memo-Template.md` |
| `docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md` | `docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md` |
| `docs/PLANS/implementation/L2-99_Evidence-Checklist.md` | **Removed 2026-05-20** — `to-do.md` OPS-006 |
| `docs/PLANS/implementation/L2-Chroma-Vector-Backend-Implementation.md` | `docs/PLANS/implementation/L2-Chroma-Vector-Backend-Implementation.md` |

---

## 3) New files to create (no old source)

| New file | Purpose |
|---|---|
| `docs/START-HERE.md` | Deterministic bootstrap for new conversations |
| `docs/README.md` | High-level docs index |
| `docs/CURRENT/As-Built-Snapshot.md` | Dated current-state truth |
| `docs/CURRENT/Route-Inventory.md` | Route table extracted from `src/server/routes.ts` |
| `docs/CURRENT/Config-Flags-Inventory.md` | Env + feature flag inventory from `src/config/schema.ts` |
| `docs/CURRENT/Capability-Matrix.md` | Capability to implementation matrix |
| `docs/CURRENT/Known-Deltas.md` | **Removed 2026-05-20** — use `to-do.md` |
| `docs/API/OpenAPI-Authority.md` | Contract authority and ownership rules |
| `docs/API/Route-to-Contract-Map.md` | Route -> OpenAPI -> SPEC traceability |
| `docs/TARGET/docs-manifest.json` | Machine-readable navigation manifest |
| `docs/TARGET/Glossary.md` | Canonical vocabulary |
| `docs/TARGET/Doc-Header-Contract.md` | Required header schema for key docs |
| `docs/TARGET/Context-Bootstrap-Profiles.md` | Quick/deep/task-specific reading profiles |
| `docs/ARCHIVE/superseded/README.md` | Archive policy and pointer format |

---

## 4) Optional archive moves (if replacing existing files)

When replacing a legacy doc with a new canonical file, move the old one to:

- `docs/ARCHIVE/superseded/<original-file-name>.md`

Add a one-line pointer at top:

`Superseded by: <new canonical path> on <YYYY-MM-DD>.`

---

## 5) Execution checklist

- [x] Create destination folders.
- [x] Move files per mapping.
- [x] Resolve duplicates (`Docs/` vs `docs/`) by keeping canonical destination only (single `docs/` tree).
- [x] Update internal links to new paths (bulk replace + manual fixes).
- [x] Update `README.md` and `AGENTS.md` references.
- [x] Sync stale `dist/**/*.js` JSDoc `@see` paths with `src/` (until next `npm run build`).
- [ ] Run doc grep for broken links/casing (periodic).
- [ ] Run `npm run verify:sow` locally (required before merge).

---

## 6) Changelog

| Date | Change |
|---|---|
| 2026-03-24 | Initial checked-in move map created. |
| 2026-03-24 | Migration applied in working tree: moves + link rewrites + bootstrap artifacts. |

