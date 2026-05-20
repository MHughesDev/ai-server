# Go / No-Go Decision Runbook (PR-033 / L2-08 Phase 3)

Formal production release decision with **signatories** and an **evidence package** assembled from repo artifacts and CI.

## Roles (required for GO)

| Role | `role` value | Responsibility |
|------|----------------|----------------|
| Engineering lead | `engineering_lead` | Code quality, `verify:sow`, API contract parity |
| Security / risk | `security_risk` | Auth, secrets, tools, compliance posture |
| Operations / SRE | `operations_sre` | Deploy path, drills, rollback, staging proof |

Optional: `product_owner` (not required by automated validation).

## Evidence package

### Assemble (automated)

```bash
# After drills and build (CI does this in release-gates):
npm run build
npm run drill:rollback
npm run drill:incidents
npm run release:artifacts

# Full package with verify:sow (release captain):
GO_NO_GO_RUN_VERIFY=true npm run go-no-go:package
```

Output: **`artifacts/go-no-go-evidence-package.json`**

Contains:

- `technical_gates` — automated + manual checklist items
- `artifact_references` — release manifest, drill evidence files
- `signatories` — from `GO_NO_GO_SIGNATORIES_JSON`
- `decision` — from `GO_NO_GO_DECISION_JSON`
- `recommended_outcome` — `go` | `no_go` | `pending` (technical recommendation)

### Signatories and decision (human)

Copy templates:

- `docs/OPERATIONS/templates/Go-No-Go-Signatories.example.json`
- `docs/OPERATIONS/templates/Go-No-Go-Decision.example.json`

Set env and re-assemble:

```bash
export GO_NO_GO_SIGNATORIES_JSON="$(cat path/to/signatories.json)"
export GO_NO_GO_DECISION_JSON="$(cat path/to/decision.json)"
npm run go-no-go:package
```

Validate GO decision:

```bash
npm run go-no-go:validate
```

## Meeting flow

1. **Pre-read:** `docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md` checklist §1–10.
2. **Review CI artifacts:** `release-manifest`, `rollback-drill-evidence`, `incident-drill-evidence`, `go-no-go-evidence-package`.
3. **Confirm staging evidence** (manual gates in package: staging deploy, production config).
4. **Record decision:** `go`, `no_go`, or `pending` with rationale.
5. **Collect signatures** — all three required roles for **GO**.
6. **Publish** final `go-no-go-evidence-package.json` to release record / ticket.

## CI

GitHub Actions **`release-gates`** uploads **`go-no-go-evidence-package`** (technical assembly; signatories added by ops before production cut).

## Implementation

- `src/governance/go-no-go.ts` — `assembleProductionGoNoGoPackage`, `validateSignatoriesForGo`, `validateProductionGoNoGoDecision`
- `docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md` — master checklist

## References

- L2-08 Phase 3 — `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md`
- Release execution — `Release-and-Rollback.md`
