# Harness Readiness Governance Runbook (L2-99)

Runbook for the Deferred Coding Agent Harness Readiness Gate. Owner: Program Lead; escalation: Program Lead → Security Lead → Executive sponsor.

---

## Gate workflow overview

1. **Phase 0**: Criteria and scorecard framework approved and frozen.
2. **Phase 1**: Evidence collected and validated (all dimensions, freshness).
3. **Phase 2**: Readiness scored; risk register updated.
4. **Phase 3**: Formal go/no-go session; signed decision memo.
5. **Phase 4**: Post-decision action plan (pilot or remediation).

---

## Feature flag

- **Flag**: `governance_harness_readiness_gate_active` (see `src/config/schema.ts`).
- **Env**: `GOVERNANCE_HARNESS_READINESS_GATE_ACTIVE` (default: true).
- When true, gate workflow tooling and checks are active; harness execution remains false until approved.

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
- **Plan**: `docs/PLANS/Implementation-plans/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md`.
- **Handoff**: `docs/PLANS/Implementation-plans/L2-99_Handoff.md` (usage, CI, references).
- **Templates**: `L2-99_Evidence-Checklist.md`, `L2-99_Decision-Memo-Template.md` (same folder as plan).
- **SPECs**: 18 Observability, 19 Security and Isolation, 21 Test and Eval Plan, 22 Runbooks and Operations.
