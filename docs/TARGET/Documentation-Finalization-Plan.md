# Documentation Finalization Plan

**Purpose:** Single executable plan to finish documentation work: **(1)** align user-facing and operational docs with **current code**, **(2)** remove cross-doc contradictions, **(3)** tie remaining gaps to **`docs/TARGET/Target-State-Backlog.md`** (`WANT-xxx`) instead of duplicating normative prose everywhere.

**Related:** [`Target-State-Backlog.md`](./Target-State-Backlog.md) (what we eventually want). [`Code-Docs-Parity-Audit-Plan.md`](./Code-Docs-Parity-Audit-Plan.md) — how to **detect** code vs doc differences before fixing. This plan focuses on **as-built truth** + **honest deltas**.

**Authority (from `AGENTS.md`):**

| Layer | Source of truth |
|-------|-----------------|
| HTTP surface | `src/server/routes.ts` |
| Config & flags | `src/config/schema.ts` (+ env reads documented there) |
| Public API description | `openapi.yaml` + `docs/SPEC/02_API_Contracts.md` |
| Normative long-term target | `docs/ARCHITECTURE/Architecture_document_Finalized.md` + SPECs; gaps → `WANT-xxx` |

**Definition of done (documentation):**

1. `openapi.yaml` and `docs/SPEC/02_API_Contracts.md` match `routes.ts` (paths, methods, auth expectations).
2. `docs/SPEC/20_Config_and_FeatureFlags.md` matches `schema.ts` for every exported flag and important env var.
3. `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` describes **current behavior** and **remaining gaps** without contradicting (1)–(2).
4. `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` gap rows are **verified** (closed / partial / open) with date; stale “critical missing” rows removed or corrected.
5. `docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md` agent checklist and blocking gates reflect (1)–(4).
6. `docs/OPERATIONS/Production-Deployment-Guide.md` matches real startup, Docker/compose, probes, and env; no optimistic claims unsupported by code.
7. `npm run verify:sow` passes on the branch that contains doc updates (same bar as code changes).
8. A brand-new conversation can bootstrap context from one entrypoint in under ~3 minutes and low token cost.
9. High-traffic docs include a standardized top header block (`Doc role`, `When to open`, `Do not use for`, `Source-of-truth rank`, `Last verified`).
10. A machine-readable docs manifest exists for deterministic navigation (`docs/TARGET/docs-manifest.json`).
11. “Target” and “current state” are separated: target in `docs/TARGET/Target-State-Backlog.md`, current in readiness/gap docs.

**Out of scope for this plan:** Human-only gates (staging sign-off, L2 drills, L2-99 evidence forms) — docs **prepare** links and checklists; they do not replace operations.

---

## AI-agent-first documentation architecture (ultimate approach)

**Design goal:** Maximize correctness and minimize token usage when an AI agent starts from scratch.

### Required information architecture

| Artifact | Purpose | Token profile |
|----------|---------|---------------|
| `docs/START-HERE.md` | Single deterministic entrypoint for new conversations: “read these 3 docs first.” | ~150-250 lines |
| `docs/CURRENT/As-Built-Snapshot.md` | Short, dated summary of current runtime truth (routes, auth mode, async mode, key flags). | ~300-500 lines |
| `docs/TARGET/Target-State-Backlog.md` | Normative “what we eventually want” with `WANT-xxx` IDs. | medium/large (reference, not always loaded fully) |
| `docs/TARGET/docs-manifest.json` | Machine-readable map: path, role, priority, owner, last_verified, tags, bootstrap_order. | tiny (fast parse) |
| `docs/TARGET/Glossary.md` (optional) | Canonical terms to reduce synonym drift (`workflow`, `pipeline_type`, `route`, `plan`). | small |

### Header contract for key docs (top of file)

All key docs should begin with a small header block:

- `Doc role:` (`normative-target` | `current-state` | `runbook` | `plan` | `checklist`)
- `Canonical for:` (what this file is authoritative for)
- `Not authoritative for:` (what this file must not define)
- `When to open:` (trigger, e.g. “editing routes”, “changing config schema”)
- `Last verified:` ISO date + short method (`routes.ts diff`, `verify:sow`, etc.)
- `Linked IDs:` relevant `WANT-xxx` and/or `GAP-xxx`

### Token-efficiency rules

1. Keep first-screen summaries short and deterministic (5-10 bullets max).
2. Keep normative requirements in one place; other docs link by ID.
3. Use stable IDs (`WANT-xxx`, `GAP-xxx`) instead of repeating long prose.
4. Split large docs into “Summary + Details” so agents can load summary first.
5. Avoid duplicated route/config tables across multiple files; one canonical table, others link.

---

## Phase 0 — Preconditions (half day)

| Step | Action | Output |
|------|--------|--------|
| 0.1 | Run `npm run verify:sow` on `main` (or release branch). | Baseline; fix code first if red. |
| 0.2 | Resolve **`docs/` vs `Docs/`** for this repo: canonical layout lives under lowercase `docs/` with subfolders per `docs/TARGET/docs-move-map.md` (applied 2026-03-24). Fix any straggler `Docs/` or old paths in links. | No broken links on case-sensitive checkout. |
| 0.3 | Assign a **doc DRI** (owner) for merge conflicts on narrative files. | Named owner. |

---

## Phase 0.5 — Agent navigation and context bootstrap (new)

**Goal:** New conversation gets high-confidence context fast, with minimal tokens.

| Step | Action | Output |
|------|--------|--------|
| 0.5.1 | Create `docs/START-HERE.md` with deterministic read order: (`AGENTS.md` constraints) -> (`docs/CURRENT/As-Built-Snapshot.md`) -> (`docs/TARGET/Target-State-Backlog.md`) -> domain doc by task (API/config/ops). | Single bootstrap entrypoint |
| 0.5.2 | Create `docs/CURRENT/As-Built-Snapshot.md` with dated, concise truth table: routes, auth boundary, async posture, model/tool/memory posture, required flags/env. | Current-state snapshot |
| 0.5.3 | Add standardized header block to key docs: `SPEC/02`, `SPEC/20`, Go/No-Go summary, gaps report, deployment guide, target backlog. | Predictable doc intros |
| 0.5.4 | Create `docs/TARGET/docs-manifest.json` with fields: `path`, `doc_role`, `canonical_for`, `priority`, `bootstrap_order`, `last_verified`, `owner`, `tags`. | Machine-readable navigation map |
| 0.5.5 | Add “Context budget” notes in `START-HERE.md`: quick path (small token), deep path (larger token), and task-specific path. | Token-aware onboarding |
| 0.5.6 | Add “Do not trust blindly” section in `START-HERE.md` listing docs known to be historical/planning-heavy unless verified. | Lower hallucination/drift risk |

---

## Phase 1 — Mechanical alignment (API + contracts)

**Goal:** One story for “what the server exposes.”

| Step | Action | Files |
|------|--------|--------|
| 1.1 | Extract route list from `src/server/routes.ts` (method + path + notes: auth, body). | Working notes |
| 1.2 | Diff vs `openapi.yaml`; add/remove paths, security schemes, request/response shapes. | `openapi.yaml` |
| 1.3 | Mirror the same in prose: sync/async, jobs, errors, versioning. | `docs/SPEC/02_API_Contracts.md` |
| 1.4 | Grep docs for removed or renamed paths (e.g. old “sync-only only” assertions); fix or qualify with “current as of &lt;date&gt;”. | `docs/**/*.md` (targeted) |

**Verification:** `npm run verify:sow`; if the repo has an OpenAPI lint step, it passes.

---

## Phase 2 — Config and feature flags

**Goal:** Deployers see one checklist that matches code.

| Step | Action | Files |
|------|--------|--------|
| 2.1 | From `src/config/schema.ts`, list env-backed keys and defaults (script or manual table). | Notes |
| 2.2 | Reconcile `docs/SPEC/20_Config_and_FeatureFlags.md`: name, default, meaning, **enforced vs advisory** (grep `schema` + runtime for each flag). | SPEC 20 |
| 2.3 | Update `docs/OPERATIONS/Production-Deployment-Guide.md` env sections to match SPEC 20; remove duplicate contradictory tables. | Deployment guide |
| 2.4 | Where a flag is parse-only, either **wire behavior** (code) or **document “not enforced”** until wired — prefer one sentence + link to `WANT-052` in target backlog. | SPEC 20 + gaps report |

---

## Phase 3 — Narrative “current state” docs

**Goal:** Gaps and readiness reports tell the truth.

| Step | Action | Files |
|------|--------|--------|
| 3.1 | Rewrite **§9** (and similar) in `docs/OPERATIONS/Production-Readiness-Gaps-Report.md`: split **Implemented** vs **Remaining** with dates; remove bullets that duplicate fixed issues (e.g. shutdown/TLS/readiness if verified in code). | Gaps report |
| 3.2 | Walk each row in `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` (GAP register): mark **Verified closed &lt;date&gt;**, **Partial**, or **Open** with pointer to `WANT-xxx` or GitHub issue. | SOW gap closure |
| 3.3 | Update `docs/SPEC/00_System_Overview.md` and `docs/SPEC/01_Principles_and_Invariants.md` **“current implementation notes”** to match Phase 1–2 (or add a short “As-built snapshot” subsection with date). | SPEC 00, 01 |
| 3.4 | Refresh `docs/OPERATIONS/Production-Readiness-Go-No-Go-Summary.md`: agent checklist, scorecard rows, blocking checklist — **do not** claim doc reconciliation done until 3.1–3.3 are merged. | Go/No-Go summary |

---

## Phase 4 — Plans and checklists (deduplicate)

**Goal:** One backlog shape; plans stay sequencing, not a second gap register.

| Step | Action | Files |
|------|--------|--------|
| 4.1 | `docs/PLANS/Cleanup-and-Finalization-Checklist.md` — close completed items; leave open items only; add link to this finalization plan. | Cleanup checklist |
| 4.2 | `docs/PLANS/00_Master-Delivery-Plan.md` — update unchecked tasks vs reality; cancel or move obsolete tasks; reference `WANT-xxx` for future work. | Master plan |
| 4.3 | L2 handoff / implementation plan files: **close** stale checkboxes or add **“Superseded / done as of &lt;date&gt;”** one-liners. | `docs/PLANS/implementation/*.md` (incremental) |

---

## Phase 5 — Target backlog linkage

**Goal:** “What we want” stays in `Target-State-Backlog.md`; everything else references it.

| Step | Action | Files |
|------|--------|--------|
| 5.1 | For each **open** gap in gaps report / SOW, add **WANT-xxx** in the gap row or footnote. | Gaps report, SOW |
| 5.2 | Fill **`Implementation status`** in `docs/TARGET/Target-State-Backlog.md` (Met / Partial / Not started + evidence: file path or test name). | Target backlog |
| 5.3 | In `docs/ARCHITECTURE/Architecture_document_Finalized.md` §18, optional addendum: “See `docs/TARGET/Target-State-Backlog.md` for tracked implementation status of SHALLs” (one paragraph). | Architecture |

---

## Phase 6 — Verification and merge gate

| Check | Command / review |
|--------|-------------------|
| Build | `npm run verify:sow` |
| Routes | `routes.ts` ↔ `openapi.yaml` ↔ SPEC 02 |
| Config | `schema.ts` ↔ SPEC 20 ↔ deployment guide |
| No stale claims | Grep for known obsolete phrases (e.g. “no `/token/exchange`”, “sync-only” if async exists) — fix or remove |
| Cross-links | README / AGENTS / Overview point to `docs/TARGET/` and finalization status |
| Agent bootstrap | New chat can follow `docs/START-HERE.md` and identify canonical docs + known non-authoritative docs in < 3 minutes |
| Manifest validity | `docs/TARGET/docs-manifest.json` paths exist and metadata is complete for priority docs |

---

## Suggested schedule (indicative)

| Week | Phases |
|------|--------|
| 1 | 0, 0.5, 1 |
| 2 | 2, 3 |
| 3 | 4, 5, 6 + optional Architecture §18 addendum |

Parallelizable: Phase 0.5 (navigation artifacts) can run in parallel with Phase 1 (API) once canonical docs casing is settled.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-24 | Initial documentation finalization plan. |
| 2026-03-24 | Added AI-agent-first navigation architecture, bootstrap artifacts, and token-efficiency requirements. |

---

*End of plan.*
