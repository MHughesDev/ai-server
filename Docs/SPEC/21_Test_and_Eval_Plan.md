# 21 Test and Eval Plan

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Sections 13, 18.8, 18.12).
- Current-state gaps: `docs/Production-Readiness-Gaps-Report.md` (coverage gaps, eval dataset size, alert simulation work).

## Test Pyramid
- **Unit:** contracts, policy logic, gateway behavior, workflow/engine registries.
- **Integration:** control-plane routing, workflow execution, model/tool/memory gateway integration.
- **End-to-end:** request-to-response behavior, error taxonomy, telemetry continuity, redaction.

## Required Quality Areas
- Governance correctness (policy/budget/dispatch gating).
- Workflow runner correctness (dependency graph validation, stop conditions, nesting).
- Memory scope safety and retrieval behavior.
- Security/audit and observability sink behavior.

## Evaluation Harness
- Gold datasets by workflow type.
- Routing and strategy regression checks.
- Retrieval and multimodal quality baselines.
- Safety and policy conformance scenario set.

## Quality Gates
- Latency and reliability SLOs.
- Cost thresholds and budget-enforcement checks.
- Security and policy-bypass zero tolerance.
- No production path should rely on stub-only engines/gateways.

## Current-State Notes
- Expand eval baseline beyond minimal cases.
- Add missing high-value unit coverage called out in gaps report (memory gateway, registry surfaces, evaluation paths).
