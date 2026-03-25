# 06 Control Plane Spec

## Source Alignment
- Normative architecture: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 3, 9.3, 16, 18.3, 18.4).
- Current-state gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` (runtime enforcement and control-path hardening).

## Purpose
Control runtime that governs execution decisions and constraints without directly generating end-user outputs.

## Core Modules
- Policy evaluation.
- Strategy and workflow selection.
- Resource and budget assignment.
- Dispatch gating.
- Execution supervision.
- Failure handling and evaluation hooks.

## Inputs
- `CanonicalRequest`, `IntentBundle`, caller context, runtime health signals, and platform config.

## Outputs
- `PolicyDecision`.
- Workflow execution spec (`PipelinePlan` in current implementation, where `pipeline_type` maps to workflow id).
- Route/deny decision with explicit reason.

## Authority Boundary
Only this layer may:
- Start/stop loops.
- Invoke nested workflows.
- Allocate or tighten budgets.
- Enforce global stop conditions and retries.

Engines may only produce artifacts and optional non-binding next-action suggestions.

## Production Requirements
- Governance path must be non-bypassable.
- Budget fields must be enforced at runtime, not only computed.
- Request deadlines must be globally enforced.

## Current-State Notes
- Parts of runtime enforcement (deadline/cost, some gate flags) are still tracked as open production gaps.
