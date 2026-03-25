# 14 Pipelines Catalog

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 11, 16, 18.4).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

## Terminology
- Architecture term: **workflow**.
- Current runtime field: `pipeline_type` (maps to workflow id).

## Active Workflow Catalog

| Workflow (`pipeline_type`) | Typical entry signal | Core engine sequence | Notes |
|---|---|---|---|
| `reactive_chat` | General chat/Q&A | memory (optional) -> execution -> synthesis | Fast path; retrieval when policy + plan allow it |
| `coding_agent` | Tool-heavy coding tasks | execution -> tool -> evaluation -> synthesis | Tool path policy-gated; autonomous loop behind feature gate |
| `deep_research` | Research/report intent hints | execution -> evaluation -> synthesis | Produces research-oriented structured artifact |
| `decision` | Recommendation/choice intent hints | execution -> evaluation -> synthesis | Produces decision memo artifact |
| `tool_automation` | Automation/tooling intent hints | classification -> planning -> tool -> evaluation -> synthesis | Runner-based workflow |
| `extraction` | Extraction/normalization intent hints | classification -> execution -> evaluation -> synthesis | Runner-based workflow |
| `verification` | High-assurance/verification intent hints | execution -> evaluation -> execution -> synthesis | Runner-based workflow |
| `planning_only` | Planning/decomposition tasks | planning -> evaluation -> synthesis | Runner-based workflow |
| `batch_analysis` | Batch/aggregate analysis tasks | planning -> execution -> evaluation -> synthesis | Runner-based workflow |

## Entry and Routing Rules
- Workflow selection is based on intent, complexity/risk, policy allowlists, and capability needs.
- Workflows are modality-agnostic; modality does not define workflow identity.
- Policy may intentionally restrict workflow availability per caller/tenant.

## Workflow Definition Contracts
- Definitions are versioned (`workflow_id`, `version`, `steps`, `entry_conditions`, `stop_conditions`).
- Supported step kinds include `engine_call`, `workflow_call`, and `decision`.
- Nested workflow calls must inherit (or tighten) parent budgets.

### Decision Step Semantics (Agent 3, 2026-03-06)
Decision steps enable conditional branching based on previous step results:
- **Branch Conditions**: Simple expressions like `score > 0.8`, `passed == true`, `label == 'urgent'`
- **Supported Operators**: `>`, `>=`, `<`, `<=`, `==`, `!=`
- **Branch Structure**: Each branch has `condition` (string) and `target_step` (step ID)
- **Default Target**: Optional `default_target` for when no branch conditions match
- **Data Sources**: Conditions evaluate against artifact content and telemetry metrics

Example decision step:
```json
{
  "step_id": "decision1",
  "kind": "decision",
  "ref": "route",
  "depends_on": ["evaluation_step"],
  "branches": [
    { "condition": "score > 0.8", "target_step": "high_quality_path" },
    { "condition": "passed == false", "target_step": "retry_path" }
  ],
  "default_target": "standard_path"
}
```

## Production Requirements
- Definition validation must reject cycles and invalid dependency references.
- `stop_conditions` must be enforced centrally by workflow runtime.
- Policy allowlists and registered workflows must stay synchronized to avoid dead routes.

### Workflow Validation (Agent 3, 2026-03-06)
The `WorkflowDefinitionSchema` enforces production-ready validation:
- **Cycle Detection**: DFS-based detection prevents infinite loops in `depends_on` graphs
- **Dependency Validation**: All `depends_on` refs must exist as step IDs
- **Branch Target Validation**: All decision branch `target_step` refs must exist
- **Duplicate Prevention**: Step IDs must be unique within a workflow
- **Schema Enforcement**: Zod schema validation at registration time
