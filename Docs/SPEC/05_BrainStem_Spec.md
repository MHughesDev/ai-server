# 05 BrainStem Spec

## Purpose
First cognition layer for canonicalization and intent extraction.

## Responsibilities
- Normalize multimodal input into canonical request.
- Load lightweight session context.
- Produce intent/confidence/complexity/risk hints.
- Emit routing signals for control plane.

## Output
`CanonicalRequest` + `IntentBundle`.
