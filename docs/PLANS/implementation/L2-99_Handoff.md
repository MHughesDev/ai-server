# L2-99 Handoff – Deferred Coding Agent Harness Readiness Gate

**Plan:** L2-99 Deferred Coding Agent Harness Readiness Gate  
**Status:** Implementation complete (code and templates); gate workflow ready for process execution  
**Handoff to:** Next-cycle constrained coding-agent pilot (if go), or remediation cycle (if no-go)

---

## 1) Gate start checklist (what’s done)

- [x] Readiness dimensions and scorecard framework in code (`src/governance/`: security, policy_enforcement, observability, reliability, operations, governance)
- [x] Default thresholds and weights (`DEFAULT_THRESHOLDS`, dimension weights); configurable for Phase 0 freeze
- [x] Evidence validation: completeness and freshness (`validateEvidence`, `isEvidenceComplete` in `src/governance/evidence.ts`)
- [x] Scorecard calculator: category scores, weighted total, pass/fail (`computeScorecard`, `computeCategoryScore` in `src/governance/scorecard.ts`)
- [x] Types: EvidenceItem, RiskEntry, ReadinessScorecard, DecisionMemo, ExceptionRecord (`src/governance/types.ts`)
- [x] ~~Schema feature flag `governance_harness_readiness_gate_active`~~ **Not in code (2026-03-24):** That key is **not** in `FeatureFlagsSchema`. This gate is **process + evidence**; autonomous harness execution is gated by **`harness_autonomous_execution_enabled`** per **`docs/SPEC/20_Config_and_FeatureFlags.md`**.
- [x] Runbook: `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md` (evidence failure, scorecard disputes, sign-off, exceptions)
- [x] Evidence checklist template: `docs/PLANS/implementation/L2-99_Evidence-Checklist.md`
- [x] Decision memo template: `docs/PLANS/implementation/L2-99_Decision-Memo-Template.md`
- [x] Unit tests: scorecard and threshold logic, evidence validation (`src/governance/*.test.ts`)
- [ ] Phase 0: Assign evidence owners and obtain pre-scoring approval (process)
- [ ] Phase 1–4: Evidence collection, scoring, go/no-go session, post-decision plan (process)

**Definition of ready for gate execution:** All code and doc items above are done. Program/Security Lead can run evidence collection, validation, scoring, and use templates for decision memo and exceptions.

---

## 2) Governance module usage

### Scorecard

```ts
import { computeScorecard, DEFAULT_THRESHOLDS } from "./governance/index.js";
import type { EvidenceItem, RiskEntry } from "./governance/index.js";

const evidence: EvidenceItem[] = [ /* from evidence checklist */ ];
const risks: RiskEntry[] = [ /* from risk register */ ];
const card = computeScorecard(evidence, risks); // or pass custom thresholds
// card.weightedTotal, card.passed, card.categoryScores, card.evidenceCompletenessPercent
```

### Evidence validation

```ts
import { validateEvidence, isEvidenceComplete } from "./governance/index.js";

const result = validateEvidence(evidence, { maxStaleDays: 30, requireAllDimensions: true });
// result.valid, result.missingDimensions, result.staleCount, result.errors
```

### Thresholds

- **Default:** `minWeightedTotal: 70`, `maxCriticalGaps: 0`, `minEvidenceCompletenessPercent: 100`.
- Override via `ScorecardThresholds` when calling `computeScorecard()`; freeze in Phase 0 before scoring.

---

## 3) Runtime flags vs L2-99 process gate

| Topic | As-built (2026-03-24) |
|--------|------------------------|
| **Readiness gate (L2-99)** | **Process:** evidence, scorecard, sign-off — **no** dedicated schema flag. Historical plan text may cite `governance_harness_readiness_gate_active`; it was **never** added to `FeatureFlagsSchema`. |
| **Autonomous coding-agent loop** | Schema flag **`harness_autonomous_execution_enabled`** / env **`HARNESS_AUTONOMOUS_EXECUTION_ENABLED`** — see **`docs/SPEC/20_Config_and_FeatureFlags.md`**. |
| **Canonical flag list** | **`docs/SPEC/20_Config_and_FeatureFlags.md`** |

---

## 4) CI and verification

| Check | Command / location |
|-------|---------------------|
| Unit tests (scorecard, evidence) | `npm test` (governance/*.test.ts) |
| Config / feature flags | `npm test` (config/schema.test.ts); normative list in SPEC 20 |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |

---

## 5) Known limits and deferred (process)

- **Process-only:** Evidence collection (P1-01), owner assignment (P0-02), signatory approval (P0-03, P3-01–P3-03), risk register updates (P2-03), post-decision pilot/remediation plan (P4-01–P4-03) are human/governance steps; no further code in this plan.
- **Integration/e2e:** Evidence ingestion from CI and reporting workflow can be added in a future iteration (Section 7.2/7.3); current implementation supports programmatic validation and scoring.
- **Threshold weightings:** Exact go/no-go weights are an open decision (Plan §4.3); code uses defaults until frozen in Phase 0.

---

## 6) Open risks and owners

| Risk | Owner | Mitigation |
|------|--------|-------------|
| Criteria ambiguity leads to contested decisions | Program Lead | Freeze criteria before evidence scoring (Phase 0 exit). |
| Missing evidence delays decision | QA Lead | Early evidence audit; use `validateEvidence()` and checklist. |
| Subjective overrides undermine score | Security Lead | Require evidence-linked justification for any manual override. |
| Sign-off incomplete | Program Lead | Decision remains pending; reconvene with full quorum (runbook). |

---

## 7) References

- Plan: `docs/PLANS/implementation/L2-99_Deferred-Coding-Agent-Harness-Readiness-Gate.md`
- Governance code: `src/governance/` (types, scorecard, evidence, index)
- Config: `src/config/schema.ts` — use **`FeatureFlagsSchema`** / SPEC 20 (**no** `governance_harness_readiness_gate_active` key)
- Runbook: `docs/OPERATIONS/RUNBOOKS/Harness-Readiness-Gate.md`
- Evidence checklist template: `docs/PLANS/implementation/L2-99_Evidence-Checklist.md`
- Decision memo template: `docs/PLANS/implementation/L2-99_Decision-Memo-Template.md`
- SPEC: `docs/SPEC/20_Config_and_FeatureFlags.md`, `docs/SPEC/22_Runbooks_and_Operations.md`
