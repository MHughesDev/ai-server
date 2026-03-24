# Code ↔ Docs Parity Audit Plan

**Purpose:** Systematically compare **implemented behavior** in `src/` (and repo config) to **what documentation claims**, produce a **discrepancy register**, then update docs (or code, if the bug is in code) so **as-built docs** match reality.

**Related:** [`Documentation-Finalization-Plan.md`](./Documentation-Finalization-Plan.md) (phases 1–3 execute many of these fixes). [`Target-State-Backlog.md`](./Target-State-Backlog.md) holds **target** intent; this audit focuses on **current** truth.

**Principle:** For “what exists today,” **code wins**. Docs either match code or explicitly say **“not implemented / deferred”** with a `WANT-xxx` or issue link.

---

## 1) Definitions

| Term | Meaning |
|------|---------|
| **Ground truth** | Observable behavior: routes mounted, middleware order, config parsed, branches taken. |
| **Parity** | Doc statements are **verifiable** from code or runtime (or marked as aspirational). |
| **Discrepancy** | Doc says X, code does Y (or doc is silent where code exposes a contract). |

---

## 2) Source-of-truth pairing (what to compare)

| Code / artifact | Compare to | Audit focus |
|-----------------|------------|-------------|
| `src/server/routes.ts` | `openapi.yaml`, `docs/SPEC/02_API_Contracts.md` | Paths, methods, auth, request/response shapes, error codes cited |
| `src/config/schema.ts` (+ grep `process.env` in `src/` if needed) | `docs/SPEC/20_Config_and_FeatureFlags.md`, `docs/OPERATIONS/Production-Deployment-Guide.md` | Env names, defaults, flags **enforced** vs parse-only |
| `src/server/auth.ts`, `src/ingress/validate.ts`, `src/server/query-handler.ts` | SPEC 02, 04, 19, gaps report | Token exchange, caller binding, auth failure behavior |
| `src/server/rate-limit.ts`, `src/server/query-handler.ts` | SPEC 04, 02 | Rate limit presence, 429 mapping |
| `src/server/dependencies.ts`, `src/server/routes.ts` (`/healthz`, `/readyz`) | SPEC 22, deployment guide, runbooks | 503 semantics, which deps checked |
| `src/queue/*`, job routes in `routes.ts` | SPEC 02, OpenAPI | Async/job lifecycle vs sync-only |
| `src/memory/*`, `src/gateways/*` | SPEC 15–17, gaps report | Stub vs real paths, timeouts, backends |
| `src/observability/*`, `src/security/audit-logger.ts` | SPEC 18, 19 | Sinks, blocking vs async, events |
| `Dockerfile`, `docker-compose.yml`, `k8s/**/*.yaml` | `docs/OPERATIONS/Production-Deployment-Guide.md` | Build stages, probes, env vars |
| `.github/workflows/*.yml` | Go/No-Go summary, deployment guide | CI steps vs claimed gates |

---

## 3) Audit methodology (recommended order)

### Phase A — Mechanical extraction (automatable)

1. **Routes** — Parse or manually list from `routes.ts`: `method + path` + obvious middleware (e.g. auth wrapper). Store in `docs/CURRENT/Route-Inventory.md` (table).
2. **OpenAPI** — List paths in `openapi.yaml`; **diff** against route inventory (missing/extra).
3. **Config** — Export list of Zod/env keys from `schema.ts` (script or structured read); diff against SPEC 20 and deployment guide env tables.
4. **Grep for stale claims** — Search docs for phrases known to drift, e.g. `sync-only`, `not implemented`, `no /token/exchange`, `Implementation-plans`, `docs/Runbooks/` (old path). Each hit is a **candidate** discrepancy.

### Phase B — Semantic / behavioral (manual or agent-assisted)

For each major feature area, answer from code: **“What actually happens on this path?”** Then check SPEC 02 / gaps report / deployment guide for conflicting sentences.

Priority buckets:

1. **Security & identity** — exchange route, JWT validation, operational bearer, CORS if documented.
2. **Jobs / async** — if routes exist, document real queue behavior or mark partial.
3. **Memory / tools / models** — default gateways, env switches, deny-by-default tools.
4. **Rollout / flags** — `platform_production_rollout_enabled`, harness flags: documented vs enforced in `bootstrap` / `routes`.

### Phase C — Runtime spot-check (optional but strong)

- Start server with minimal env; hit `/healthz`, `/readyz`, `/v1/version`, one authenticated `POST /v1/query` if tests document how.
- Prefer **automated** parity: extend or reuse existing integration tests as **evidence** in the discrepancy register (“verified by `*.integration.test.ts`”).

---

## 4) Discrepancy register (deliverable)

**Living register:** [`Code-Docs-Discrepancy-Register.md`](./Code-Docs-Discrepancy-Register.md) (initial pass **2026-03-24**).

Maintain one table while auditing (markdown or spreadsheet). Suggested columns:

| ID | Area | Code reference (file:symbol or line range) | Doc reference (path + §) | Code says | Doc says | Severity | Action (doc / code / both / defer) | Owner | Status |
|----|------|-----------------------------------------------|----------------------------|-----------|----------|----------|--------------------------------------|-------|--------|

**Severity (suggested):**

- **P0** — Wrong security, wrong API contract, or deploy will fail.
- **P1** — Misleading ops (probes, env), wrong error behavior, missing documented route.
- **P2** — Wording, incomplete examples, internal link drift.

**Closure rule:** Each row ends as **Fixed**, **Won’t fix (with reason)**, or **Intentional delta** (doc must say “target not in code yet” + `WANT-xxx`).

---

## 5) Automation ideas (future / optional scripts)

Small repo-local scripts (Node or PowerShell) help repeat the audit:

1. **`scripts/extract-routes.mjs`** — Regex or TS AST over `routes.ts` → JSON list of paths.
2. **`scripts/diff-openapi-routes.mjs`** — Compare JSON to `openapi.yaml` paths.
3. **`scripts/list-config-keys.mjs`** — Walk `schema.ts` exports for env keys (heuristic) → compare to a generated checklist.

Keep scripts **read-only** first (report only); no doc mutation until humans review.

---

## 6) Exit criteria (audit complete)

- [x] Route inventory exists and matches `routes.ts` (`docs/CURRENT/Route-Inventory.md`); OpenAPI aligned on audited paths; residual rows in [`Code-Docs-Discrepancy-Register.md`](./Code-Docs-Discrepancy-Register.md).
- [ ] Config inventory matches `schema.ts`; SPEC 20 + deployment guide updated or logged.
- [x] `docs/OPERATIONS/Production-Readiness-Gaps-Report.md` — P1 contradictions for §9.1, §9.3 tenant usage, §9.8 async, §9.10 rollout, §10 summary addressed **2026-03-24** (ongoing review for other sections).
- [x] `docs/CURRENT/As-Built-Snapshot.md` filled with **Last verified** date and pointers to evidence; run `npm run verify:sow` locally and note pass date when available.
- [ ] `npm run verify:sow` passes on the branch that merges doc fixes.

---

## 7) Changelog

| Date | Change |
|------|--------|
| 2026-03-24 | Initial code–docs parity audit plan. |

---

*End of plan.*
