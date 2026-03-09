# 00 System Overview

## Source Alignment
- Normative architecture: `docs/Architecture_document_Finalized.md` (Section 18 defines production target state).
- Current-state gaps: `docs/Production-Readiness-Gaps-Report.md`.

## Purpose
Centralized AI server with a single primary endpoint (`POST /v1/query`) that applies deterministic governance before any AI execution, then runs the selected workflow through model/tool/memory gateways with full traceability.

## Layer Model
- **Layer 1:** Model primitives (atomic inference only).
- **Layer 2:** Engines (reusable, bounded, one gateway per engine).
- **Layer 3:** Workflows (versioned graphs; modality-agnostic behavior).
- **Layer 4:** Orchestration and governance (Ingress + Brain Stem + policy + budgets + workflow selection + supervision).

## High-Level Request Flow
Client -> Ingress (deterministic) -> Brain Stem (canonicalize + intent) -> Orchestrator (policy + budgets + workflow selection) -> Workflow runtime -> Engines -> Gateways -> ResponseEnvelope + telemetry.

## External Surface
- `POST /v1/query` (primary app entrypoint).
- `POST /token/exchange` (identity trust boundary; production target).
- `GET /healthz`, `GET /readyz`, `GET /metrics`, `GET /v1/version`.

## Core Invariants
- Ingress is non-cognitive.
- Cognition starts at Brain Stem.
- Orchestrator is the only authority for loops/retries/nesting/budget decisions.
- Tools and memory are gateway-only and policy-gated.
- Every request emits traceable governance and execution events.

## Current Implementation Notes
- Current runtime still contains stubs in key production paths (model/tool gateway, some engines), as tracked in the gaps report.
- Some contract and rollout surfaces are ahead of runtime behavior; docs must mark target vs current explicitly.
