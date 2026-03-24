# 03 Component Map

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 3, 9, 10, 11, 12).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

## Layered Components
- **Layer 4 (Orchestration and governance):** Ingress, Brain Stem, policy evaluation, budget/resource controls, router/dispatch gate, execution supervision.
- **Layer 3 (Workflows):** reactive_chat, coding_agent, deep_research, decision, tool_automation, extraction, verification, planning_only, batch_analysis.
- **Layer 2 (Engines):** planning, execution, evaluation, tool, memory, classification, synthesis, condensing.
- **Layer 1 (Model primitives):** provider-backed inference calls behind Model Gateway.

## Runtime Topology (current implementation shape)
- Route entry: `src/server/routes.ts` -> query handler.
- Governance path: `src/controlplane/*` + `src/router/*`.
- Workflow execution: `src/pipelines/*` and `src/workflows/*` (runner + registry + definitions).
- Gateways: `src/gateways/*` and `src/memory/*`.
- Observability and security: `src/observability/*`, `src/security/*`.

## Dependency and Authority Rules
- Ingress must not perform model reasoning, tool calls, or memory retrieval.
- Engines are bounded units; no engine-to-engine calls.
- Only orchestrator/workflow runtime can coordinate steps and loop behavior.
- Tool access is gateway-only and policy-allowlisted.
- Memory access is gateway-only and scope-enforced.
- Response assembly must include traceable telemetry and deterministic error mapping.

## Current-State Notes
- Workflow catalog is broader than earlier MVP docs and includes nested workflow capability.
- Some components are production-targeted but still rely on stubs in current runtime paths; track closure in the gaps report.
