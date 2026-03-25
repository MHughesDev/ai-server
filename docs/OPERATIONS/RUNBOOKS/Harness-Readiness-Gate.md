# Harness Readiness Governance Runbook (L2-99)

Runbook for the Deferred Coding Agent Harness Readiness Gate. Owner: Program Lead; escalation: Program Lead → Security Lead → Executive sponsor.

## Source Alignment

- Normative production requirements: `docs/ARCHITECTURE/Architecture_document_Finalized.md` (Sections 11, 18.3, 18.4, 18.12).
- Current implementation deltas/gaps: `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`.

This runbook governs when autonomous harness behavior can be enabled in production, and should be applied alongside security, observability, and policy readiness evidence.

**L2-99 gate (SOW Segment L.4):** Autonomous harness execution is **implemented** and gated by feature flag. When the readiness gate passes and security/observability sign-off is complete, enable `harness_autonomous_execution_enabled` (env: `HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true`) so the coding-agent pipeline runs the autonomous loop: (execution ↔ tool)* → evaluation → synthesis, with budgets and `HARNESS_ITERATION` observability events. Until the flag is enabled, the coding agent runs in single-pass mode only.

---

## Gate workflow overview

1. **Phase 0**: Criteria and scorecard framework approved and frozen.
2. **Phase 1**: Evidence collected and validated (all dimensions, freshness).
3. **Phase 2**: Readiness scored; risk register updated.
4. **Phase 3**: Formal go/no-go session; signed decision memo.
5. **Phase 4**: Post-decision action plan (pilot or remediation).

---

## Feature flags

- **Harness execution (in schema):** `harness_autonomous_execution_enabled` (default **false**). Env: **`HARNESS_AUTONOMOUS_EXECUTION_ENABLED=true`**. Set only after formal go decision; enables the autonomous (execution ↔ tool)* loop in the coding-agent pipeline (`src/pipelines/coding-agent-pipeline.ts`). Reads **static** `config.flags` (admin `/admin/flags` overrides do not apply).
- **Gate workflow flag:** `governance_harness_readiness_gate_active` is **not** present in `FeatureFlagsSchema` as of 2026-03-24; treat L2-99 “gate active” as **process + evidence**, not a runtime config toggle, until/unless reintroduced in `src/config/schema.ts`. Canonical flag inventory: **`docs/SPEC/20_Config_and_FeatureFlags.md`**.

---

## Evidence completeness validation failure

### Symptom

- Validation report shows &lt; 100% evidence coverage or missing mandatory artifacts.
- Scorecard run fails or decision is blocked.

### Actions

1. Run evidence validation: use `src/governance/evidence.ts` `validateEvidence()` with evidence set; check `missingDimensions` and `errors`.
2. Assign remediation owners per L2-99 evidence checklist; collect missing artifacts from upstream plans (L2-01 through L2-08).
3. If critical evidence is unavailable by deadline: treat as provisional no-go and open remediation cycle (per L2-99 Phase 1 rollback).

### Verification

- Re-run validation; `valid === true`, `completenessPercent >= 100`, `errors.length === 0`.

---

## Scorecard / threshold disputes

### Symptom

- Scoring outcome contested; manual override requested.

### Actions

1. Require evidence-linked justification for any manual override (L2-99 Phase 2 mitigation).
2. Re-run scoring with frozen thresholds; if process integrity is challenged, re-run with independent review panel (Phase 2 rollback).

### Verification

- Final score and risk disposition package approved for decision meeting.

---

## Go/no-go sign-off incomplete

### Symptom

- Required signatories absent or decision memo unsigned.

### Actions

1. Do not publish decision; reconvene with complete quorum (L2-99 Phase 3 rollback).
2. Record decision as pending; communicate timeline for reconvene.

### Verification

- Signed decision memo and exception dispositions published.

---

## Exception remediation overdue

### Symptom

- Exception register shows items past `remediationDueIso` with no closure.

### Actions

1. Alert exception owners and Program Lead (L2-99 Section 8.3).
2. Escalate to steering committee if exceptions block next-cycle kickoff.
3. Update risk register and exception log; document extended due dates if formally approved.

---

## Implementation reference

- **Types and scorecard**: `src/governance/` (types, scorecard, evidence).
- **Autonomous harness**: `src/pipelines/coding-agent-pipeline.ts` (branch on `harness_autonomous_execution_enabled`; loop honors `proposed_next_action` from execution engine); `src/engines/execution_engine.ts` (returns `proposed_next_action` when task has `suggested_tool_ref`). Observability: `HARNESS_ITERATION` event (see `src/observability/events.ts`).
- **Plan**: `docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md` (or `docs/PLANS/`).
- **Handoff**: `docs/PLANS/implementation/L2-99_Handoff.md` (usage, CI, references).
- **Templates**: `L2-99_Evidence-Checklist.md`, `L2-99_Decision-Memo-Template.md` (same folder as plan).
- **SPECs**: 18 Observability, 19 Security and Isolation, 20 Config and Feature Flags, 21 Test and Eval Plan, 22 Runbooks and Operations.
