# Start here (AI agents and humans)

**Purpose:** Deterministic bootstrap for a **new conversation** with minimal tokens.

## Read order (quick path)

1. [`AGENTS.md`](../AGENTS.md) — hard constraints and verification gate (`npm run verify:sow`).
2. [`to-do.md`](../to-do.md) — **unified open tasks** (production checklist, `WANT-xxx`, `GAP-xxx`, stubs).
3. [`docs/CURRENT/As-Built-Snapshot.md`](./CURRENT/As-Built-Snapshot.md) — **current** runtime truth (fill during doc finalization).

## Then branch by task

| Task | Open next |
|------|-----------|
| HTTP / OpenAPI / contracts | `docs/SPEC/02_API_Contracts.md`, repo root `openapi.yaml`, `src/server/routes.ts` |
| Config / flags / env | `src/config/schema.ts`, `docs/SPEC/20_Config_and_FeatureFlags.md` |
| Open tasks / backlog | [`to-do.md`](../to-do.md) |
| Production readiness / go-no-go | `docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md` |
| Current gaps narrative | `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` |
| Deploy / ops | `docs/OPERATIONS/Production-Deployment-Guide.md`, `docs/OPERATIONS/RUNBOOKS/` |
| Architecture intent | `docs/ARCHITECTURE/Architecture_document_Finalized.md` |
| Navigation manifest | `docs/TARGET/docs-manifest.json` |

## Context budget

- **Minimum viable context:** items 1–2 above + the one task row.
- **Deep context:** add `docs/REFERENCE/World-Model-Codebase.md` and the relevant SPEC.

## Do not trust blindly

- **Plans and L2 implementation write-ups** may be historical; verify against `src/` and `npm run verify:sow`.
- **Target requirements** (`WANT-xxx` in `to-do.md`) describe intent; **as-built** lives in code + `docs/CURRENT/` + operations docs.

## Doc move log

- **2026-03-24:** Reorganized under `docs/` (`ARCHITECTURE/`, `REFERENCE/`, `OPERATIONS/`, `PLANS/implementation/`). See [`docs/TARGET/docs-move-map.md`](./TARGET/docs-move-map.md).
- **2026-05-20:** Task/backlog checklists consolidated into [`to-do.md`](../to-do.md).

## Making docs match code

Extract truth from `src/`, diff OpenAPI + SPECs, track doc fixes in **`to-do.md`** §7 and **[`docs/TARGET/Code-Docs-Discrepancy-Register.md`](./TARGET/Code-Docs-Discrepancy-Register.md)**.
