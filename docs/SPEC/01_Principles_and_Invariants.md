# 01 Principles and Invariants

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 2, 3, 16, 18).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

## Non-Negotiable Invariants
- Ingress is deterministic and non-cognitive.
- Brain Stem is the first cognitive boundary.
- Governance is enforceable through machine fields (`PolicyDecision`, budgets, allowlists), not prompt-only controls.
- Engines never orchestrate and never call each other directly.
- Orchestrator is the only authority for loops, nested workflows, retries, stop conditions, and budget inheritance.
- All tool access flows through Tool Gateway; all memory access flows through Memory Gateway/abstraction.
- Every request is traceable end-to-end (decision events, engine/tool/memory telemetry, costs, errors).

## Design Principles
- Contract-first internal and external interfaces.
- Industry-agnostic core (domain specialization in workflows/config/tool adapters, not engines).
- Modality-agnostic workflow selection (intent/risk/complexity/capability needs, not input type names).
- Deterministic controls at trust boundaries (auth, policy, budgets, sandbox).
- Safe degradation when dependencies fail (structured errors and bounded fallbacks).

## Production Target Clarification
- Identity context must come from verified trust-token claims in production.
- Endpoint protection, budget enforcement, lifecycle controls, and sink persistence are required production behaviors.
- Any implementation using stubs must be explicitly marked non-production.
