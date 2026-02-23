# L2-99 Evidence Checklist (template)

Map each readiness dimension to evidence artifacts and owners. Use with `src/governance/evidence.ts` `validateEvidence()` for completeness. Fill **Owner** and **Evidence link** before Phase 1 scoring.

**Plan:** L2-99 Deferred Coding Agent Harness Readiness Gate · Phase 0–1

---

## Dimensions (required for 100% coverage)

| Dimension | Evidence description | Source plan / artifact | Owner | Evidence link / ID | Collected (ISO) | Valid |
|-----------|----------------------|-------------------------|-------|--------------------|-----------------|-------|
| security | L2-05 handoff; audit controls; isolation evidence | L2-05 | | | | |
| policy_enforcement | L2-03 handoff; policy/budget/router evidence | L2-03 | | | | |
| observability | L2-04 handoff; events, metrics, traces evidence | L2-04 | | | | |
| reliability | L2-08 SLO/reliability evidence; drill outcomes | L2-08 | | | | |
| operations | Runbooks, on-call, escalation; L2-08 ops readiness | L2-08 | | | | |
| governance | Gate framework approval; criteria freeze record | L2-99 Phase 0 | | | | |

---

## Notes

- **Valid:** Yes when artifact exists, is current, and meets checklist requirement for that dimension.
- **Collected (ISO):** Date evidence was last verified (ISO 8601). Used for freshness in `validateEvidence(evidence, { maxStaleDays: 30 })`.
- **Evidence link:** URL, path, or artifact ID (e.g. handoff doc, dashboard, CI report).
- One row per dimension minimum; multiple evidence items per dimension can be represented as additional rows or a single composite link.
