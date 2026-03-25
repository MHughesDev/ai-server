# Cleanup and Finalization Checklist

**Purpose:** Actionable list of tasks to clean up the codebase and finalize the server backend before release or handoff.  
**Source:** Full codebase review (src/, docs/, config, tests, build).  
**Last updated:** 2026-03-24.  
**Completed this session:** §1.1–1.2 (paths, .gitignore), §2 (zod, CONFIG_FILE comment), §5.1–5.2 (runbook/SPEC links, Architecture canonical = `docs/ARCHITECTURE/Architecture_document_Finalized.md`), §6.1 (verify:sow passed). **2026-03-24:** Docs restructured per `docs/TARGET/docs-move-map.md` — `docs/OPERATIONS/`, `docs/OPERATIONS/RUNBOOKS/`, `docs/ARCHITECTURE/`, `docs/REFERENCE/`, `docs/PLANS/implementation/`, `docs/START-HERE.md`.

---

## 1) Repository and paths

### 1.1 Standardize documentation paths

- [x] **Use a single docs path everywhere:** Canonical tree is `docs/` (lowercase). On Windows, `Docs/` may alias the same folder; links and `@see` should use `docs/` for Linux CI.
- [x] **Layout (2026-03-24):** Architecture and overview → `docs/ARCHITECTURE/`; production readiness + deploy → `docs/OPERATIONS/`; runbooks → `docs/OPERATIONS/RUNBOOKS/`; deep reference → `docs/REFERENCE/`; L2 write-ups → `docs/PLANS/implementation/`; bootstrap → `docs/START-HERE.md`. See `docs/TARGET/docs-move-map.md`.
- [x] **In `README.md` / `AGENTS.md`:** Links updated to new paths.
- [x] **In `src/`:** JSDoc `@see` uses `docs/ARCHITECTURE/...`, `docs/SPEC/...`, `docs/PLANS/implementation/...` as applicable.
- [x] **In `docs/`:** Internal links updated; SPEC 22 runbook index points at `docs/OPERATIONS/RUNBOOKS/`.

### 1.2 Git and build artifacts

- [x] **Add or update `.gitignore`:** There is no `.gitignore` in the repo root. Add one that includes at least:
  - `dist/`
  - `node_modules/`
  - `coverage/`
  - `.env`, `.env.local`, `*.local`
  - OS/editor cruft (e.g. `.DS_Store`, `*.log`) if desired.
- [ ] **Decide whether to track `dist/`:** If `dist/` is in git for deployment or tooling, document that in README or CONTRIBUTING; otherwise add `dist/` to `.gitignore` and build in CI only.

---

## 2) Dependencies and configuration

### 2.1 package.json

- [x] **Remove duplicate `zod`:** `zod` appears in both `dependencies` and `devDependencies`. Keep it only in `dependencies` (runtime config validation uses it); remove from `devDependencies`.

### 2.2 Config and schema

- [x] **Resolve “L2-01 gap” comment in `src/config/schema.ts`:** Comment mentions “optional CONFIG_FILE path”; implementation already supports `CONFIG_FILE`. Either remove the comment or update it to reflect current behavior.

---

## 3) Tests and coverage

### 3.1 Missing unit tests (high value)

- [ ] **`src/memory/default-store.ts`** — Add `default-store.test.ts` (factory/default wiring, store behavior).
- [ ] **`src/memory/memory-gateway.ts`** — Add `memory-gateway.test.ts` (delegation to stores, scope, error paths).
- [x] **`src/engines/evaluation_engine.ts`** — ~~Add unit test~~ **COMPLETE** (Agent 3, 2026-03-06): Enhanced evaluation engine with model-based and heuristic evaluation. Tests updated in `src/engines/evaluation_engine.test.ts`.
- [x] **`src/engines/classification_engine.ts`** — **COMPLETE** (Agent 3, 2026-03-06): Enhanced classification engine with intent/complexity/urgency/domain/risk classification. Tests updated in `src/engines/classification_engine.test.ts`.
- [x] **`src/engines/registry.ts`** — ~~Add test~~ **COMPLETE** (Agent 3, 2026-03-06): Registry updated to pass model gateway to evaluation/classification engines.
- [x] **`src/workflows/registry.ts`** — ~~Add test~~ **COMPLETE** (Agent 3, 2026-03-06): Cycle detection and dependency validation tests added. Decision step support verified.

### 3.2 Optional / lower priority tests

- [ ] **`src/controlplane/stub-policy.ts`** and **`policy-input.ts`** — Standalone unit tests if not fully covered by policy-evaluator and control-plane-impl tests.
- [x] **`src/gateways/model-gateway.ts`** — ~~Unit tests~~ **UPDATED** (Agent 3, 2026-03-06): Added circuit breaker, health checks, fallback provider, capability taxonomy. Tests pass in `src/gateways/model-gateway.test.ts`.
- [ ] **`src/server/middleware.ts`** — Unit tests for auth, body size, request ID if not covered by integration tests.
- [ ] **`src/rollout/index.ts`** — Test rollout policy and gate behavior.

### 3.3 Test policy

- [ ] **Document test strategy:** In SOW or CONTRIBUTING, state that pipelines and server routes are covered by integration tests (`query.integration.test.ts`, retrieval integration) and whether additional unit tests for routes/middleware are required.

---

## 4) Code quality and consistency

### 4.1 Logging

- [ ] **Optional — centralize logging:** `console.debug` / `console.info` / `console.warn` / `console.error` are used in `observability/emitter.ts`, `bootstrap/index.ts`, `server/index.ts`, `security/audit-logger.ts`, `eval/run-eval.ts`. If you want one place to control output (e.g. log level, structured logs), introduce a small logging abstraction and route these through it; otherwise leave as-is and note in runbooks.

### 4.2 Linting and format

- [ ] **ESLint:** Already configured; ensure `npm run lint` passes with no new violations.
- [ ] **Prettier (optional):** No Prettier config found. If the team wants consistent formatting, add `.prettierrc` and format the codebase; add a format script and optionally a lint check.

### 4.3 Type safety

- [ ] **Strict TypeScript:** Already enabled; no `: any` or `as any` found in `src/`. Keep this; run `npm run typecheck` in verification.

---

## 5) Documentation and runbooks

### 5.1 Cross-references

- [x] **Runbook links:** In Release-and-Rollback and other runbooks, use a single docs path (e.g. `docs/SPEC/20_Config_and_FeatureFlags.md`) and align with the path standard chosen in §1.1.
- [ ] **SPEC 22 and SOW:** Verify runbook index and “Runbooks and Operations” links point to existing files under `docs/OPERATIONS/RUNBOOKS/` and use the chosen path casing.

### 5.2 Stale or duplicate docs

- [ ] **Known-Gaps:** `docs/PLANS/implementation/Known-Gaps-Consolidated.md` was deleted; ensure no broken links remain to it and that any consolidated gaps are reflected in Scope-of-Work §7 or the Master plan.
- [x] **Architecture.md vs Architecture_document_Finalized.md:** Both exist under `docs/`. Decide which is canonical and update all references; consider redirect or single file to avoid confusion. Canonical set to `docs/ARCHITECTURE/Architecture_document_Finalized.md`.

---

## 6) Verification and CI

### 6.1 Pre-merge / release checks

- [x] **Run full verification:** `npm run verify:sow` (lint → typecheck → build → test) and fix any failures.
- [x] **After path changes (§1.1):** Grep for `Docs/` in repo (excluding binary/docs that intentionally allow both) and fix remaining references so no broken links on case-sensitive systems.

### 6.2 Engine guardrails

- [ ] **No engine-to-engine calls:** Per SOW, no file under `src/engines/` may import another under `src/engines/` for invocation. Confirm via grep or ESLint `no-restricted-imports`; add a test or lint rule if not already present.

---

## 7) Security and operations

### 7.1 Secrets and env

- [ ] **No secrets in repo:** Already the case; config and TLS paths come from env. Document required env vars (and optional CONFIG_FILE) in README or `docs/SPEC/20_Config_and_FeatureFlags.md` so deployers have a single checklist.

### 7.2 Runbooks

- [ ] **Runbook index:** Ensure SPEC 22 (or equivalent) lists all runbooks (Query-and-Policy-Failures, Release-and-Rollback, Harness-Readiness-Gate, Observability-and-Eval, Memory-Retrieval-Outage, etc.) with correct paths and that each file exists under `docs/OPERATIONS/RUNBOOKS/`.

---

## 8) Summary checklist (quick pass)

| Area              | Action |
|-------------------|--------|
| **Paths**         | Standardize on `docs/` in README, src @see, and docs internal links; fix Architecture reference. |
| **Git**           | Add `.gitignore` (dist, node_modules, coverage, .env); decide whether to stop committing dist. |
| **Dependencies**  | Remove duplicate `zod` from devDependencies. |
| **Config**        | Clean up CONFIG_FILE comment in schema.ts. |
| **Tests**         | Add unit tests for default-store, memory-gateway, evaluation_engine, engines/registry, workflows/registry; document pipeline/route test policy. |
| **Logging**       | (Optional) Centralize console.* behind a small logger. |
| **Format**        | (Optional) Add Prettier and format. |
| **Docs**          | Fix runbook and SPEC links; resolve Architecture.md vs Finalized; check for broken Known-Gaps links. |
| **Verify**        | `npm run verify:sow` green; confirm engine guardrails. |
| **Ops**           | Document required env vars; verify runbook index. |

---

## 9) References

- **Scope of Work:** `docs/PLANS/Scope-of-Work.md` (§4.1 execution, §7 gaps, §9 segmented tasks).
- **Verification command:** `npm run verify:sow`
- **Architecture:** `docs/ARCHITECTURE/Architecture_document_Finalized.md`
- **Config/feature flags:** `docs/SPEC/20_Config_and_FeatureFlags.md`
