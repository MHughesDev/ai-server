# 05 Brain Stem Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 2, 8.1, 8.2, 9.2).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

## Purpose
First cognitive layer that converts validated request input into routing-ready internal contracts.

## Responsibilities
- Canonicalize multimodal input into `CanonicalRequest`.
- Detect modalities and normalize artifacts/attachment handles.
- Produce `IntentBundle` with intent, confidence, complexity, risk flags, and routing hints.
- Keep cognition lightweight and bounded (no long-running loops).

## Output Contracts
- `CanonicalRequest` (normalization output).
- `IntentBundle` (routing signal output).

## Producer Model
- Canonicalization is deterministic code logic.
- Intent/complexity/risk extraction may be code-only, model-only, or hybrid by implementation.

## Boundaries
- Brain Stem does not execute workflows.
- Brain Stem does not enforce policy or budgets.
- Brain Stem does not run arbitrary tool loops.

## Production Notes
- Brain Stem must preserve trace continuity and emit decision artifacts for observability.
- Any model-assisted intent path should remain bounded and policy-compatible.
