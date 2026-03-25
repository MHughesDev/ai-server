# 12 Evaluation Engine Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 10.3, 11.7, 13, 18.12).
- Implementation status: `docs/CODEBASE-DOCS-VERIFICATION-REPORT.md` (verified features vs documentation).

## Purpose
Evaluate artifacts against criteria and provide verdict signals for workflow decisions and quality monitoring.

## Engine Contract
- Input: `EngineInvocation` with target artifacts and criteria.
- Output: `EngineResult` containing `evaluation_report` typed artifact.
- Gateway: model-only for judge behavior (no tool or memory access within this engine).

## Responsibilities
- Score pass/fail/uncertain outcomes.
- Emit confidence and evidence references.
- Support verification loops in high-assurance workflows.

## Metrics and Feeds
- Success proxy and correctness checks.
- Latency and cost impact.
- Safety and policy signal alignment.
- Regression indicators for strategy tuning.

## Current-State Notes
- ✅ **Model-based evaluation IS implemented** (src/engines/evaluation_engine.ts lines 54-108)
- Uses `modelGateway.complete()` for real evaluation against criteria
- Supports configurable `evaluationModel` parameter
- Heuristic fallback available when model evaluation fails
- Quality scoring (0-1), pass/fail verdict, multi-criteria assessment
- For production use: Configure evaluation model and provider in pipeline plan
