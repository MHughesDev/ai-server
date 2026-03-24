# Production Readiness — Scorecard & Go / No-Go Summary

**Purpose:** Single document summarizing production readiness, scorecard by dimension, go/no-go checklist for the next release, and where to find evidence in-repo. **This file is also the primary AGENT BRIEFING** for coding agents working toward deployment.

**Last updated:** 2026-03-23

**Documentation authority:** Target architecture — `docs/Architecture_document_Finalized.md`. Implementation status and gaps — `docs/Production-Readiness-Gaps-Report.md`, `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md`.

**Path note:** This repo may use `Docs/` or `docs/` on disk. Prefer **`docs/`** in new links and edits (case-sensitive CI/Linux). Existing files under `Docs/` are the same tree; adjust only when fixing broken links.

---

## AGENT PLAYBOOK — deploy to production

**Copy this block into the agent task prompt, or open this file as context.**

### Mission

Drive the repository to a **deployable state**: **green** `npm run verify:sow`, CI passing, deployment artifacts consistent with runtime, and documentation aligned with `src/server/routes.ts` and related code. Human sign-offs (L2-99, L2-08 drills) are **out of scope for code**; the agent should **prepare** evidence and fix blockers.

### Definition of done (technical)

| Gate | Command / check |
|------|------------------|
| Local verification | `npm run verify:sow` exits 0 (lint → typecheck → build → test) |
| CI parity | Same checks as `.github/workflows/ci.yml` would run |
| HTTP truth | `src/server/routes.ts` is the canonical route list; `openapi.yaml` and `docs/SPEC/02_API_Contracts.md` match it |
| Container | `docker build` succeeds (or documented alternative) |
| Probes | `k8s/` and `Dockerfile` health checks work with `OPERATIONAL_BEARER_TOKEN` behavior **or** probes are updated to send auth |

### Hard constraints (do not violate)

- **Never** commit real API keys, secrets, or `.env` with real credentials.
- **Never** disable security checks in CI to “go green”; fix lint/type errors properly.
- Prefer **minimal, reviewable** PRs: one theme per change set when possible.
- After edits, **always** run `npm run verify:sow` (or at minimum `npm run lint` then full verify).

### Suggested search order (before editing)

Use the repo search tool or grep (examples below).

| Goal | What to search |
|------|----------------|
| All HTTP routes | `path ===` in `src/server/routes.ts`; `grep` `router\.|pathname|/v1/` |
| OpenAPI drift | `openapi.yaml` paths vs `routes.ts` |
| Lint debt | Run `npm run lint` — fix files listed |
| Queue/async | `src/queue/`, `docker-compose.yml` `QUEUE_`, `QUEUE_BACKEND` |
| Deploy | `Dockerfile`, `.github/workflows/deploy-aws.yml`, `terraform/`, `k8s/` |
| Config | `src/config/schema.ts`, `docs/SPEC/20_Config_and_FeatureFlags.md` |
| Stale gap docs | `GAP-AUTH`, `token/exchange`, `sync-only` in `docs/` |

### Execution phases (do in order unless parallelizing safely)

**Phase 0 — Baseline**

1. Run `npm run verify:sow` and capture **first failing step**.
2. Record failure in a short note (or update the “Last verified” line at the bottom of this file).

**Phase 1 — Green build (P0)**

1. Fix **ESLint** errors until `npm run lint` passes.
2. Fix **TypeScript** until `npm run typecheck` passes.
3. Fix **build** until `npm run build` passes.
4. Fix **tests** until `npm test` passes.

**Primary files often involved:** `src/**/*.ts`, `jest.config.cjs`, `eslint` config if present.

**Phase 2 — Contract & docs alignment (P0)**

1. Extract route list from `src/server/routes.ts` (GET/POST paths).
2. Update `openapi.yaml` to match; remove or mark deprecated paths.
3. Update `docs/SPEC/02_API_Contracts.md` for sync/async/jobs/admin/ops routes.
4. Reconcile `docs/Production-Readiness-Gaps-Report.md` and `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` **gap register rows** that contradict current code (mark fixed, remove stale, or add “verified” notes).

**Phase 3 — Deployment artifacts (P0)**

1. **Dockerfile:** Ensure `npm run build` has TypeScript and deps available (e.g. multi-stage: install devDeps in builder, `npm ci` then `npm run build`, copy `dist/` to runtime stage with production `node_modules` only if applicable).
2. **Kubernetes:** `k8s/**/*.yaml` — liveness/readiness must use `Authorization: Bearer <token>` if `OPERATIONAL_BEARER_TOKEN` is set in prod, **or** document using an internal unauthenticated probe path (only if implemented and approved).
3. **GitHub Actions deploy:** `.github/workflows/deploy-aws.yml` — ensure job `outputs` match what deploy jobs consume (`image` tag, etc.).
4. **docker-compose.yml:** `QUEUE_BACKEND` and other env vars must match **implemented** backends in `src/queue/`.

**Phase 4 — Optional hardening (P1)**

- `npm run acceptance:observability` / `npm run eval:ci` if part of release policy.
- `docs/Production-Deployment-Guide.md` — trim claims that exceed verified behavior.
- Confirm root `README.md` lists this file (and `AGENTS.md` points here); add to `docs/Overview.md` only if you want extra discovery.

### Verification commands (run from repo root)

```bash
npm run verify:sow          # full gate: lint, typecheck, build, test
npm run lint
npm run typecheck
npm run build
npm test
npm run test:ci             # CI-style tests + coverage
npm run acceptance:observability   # optional
```

### Agent checklist (tick when done)

- [x] `npm run verify:sow` passes
- [x] `openapi.yaml` matches `src/server/routes.ts`
- [ ] SPEC 02 + gaps SOW + deployment guide do not contradict code — **SPEC 02 + OpenAPI done**; gaps report + SOW + deployment guide still need an owner pass
- [ ] Dockerfile builds; compose/env align with queue implementation — **Dockerfile + compose + `QUEUE_*` wiring fixed in repo**; tick after you run `docker build` (and optional compose up) successfully
- [x] K8s/Docker probes compatible with auth model
- [x] Deploy workflow outputs wired correctly
- [x] README or Overview links to this doc

### Where humans still decide

- Production **credentials**, **DNS**, **TLS**, **cloud account**.
- **GO / NO-GO** meeting and **L2-99 / L2-08** evidence sign-off.
- **Risk acceptance** for partial features (e.g. async in prod).

---

## Executive summary

| Question | Answer |
|----------|--------|
| **Overall readiness** | **Partial** — repo **technical verification** (`verify:sow`) is green; production GO still needs human gates (config, staging proof, drills, evidence). |
| **Recommended decision for next release** | **NO-GO** until repo verification passes, docs/runtime align, deployment path is validated, and operational evidence is complete. |
| **Strongest areas** | CI scaffolding, auth/token exchange, rate limiting, health/readiness with dependency checks, observability taxonomy (L2-04 gate), config/feature flags, broad test surface. |
| **Weakest areas** | CI + staging evidence (URLs, deploy proof), gaps/SOW/deployment-guide doc sweep, governance evidence (L2-99 template), L2-08 drills/sign-off, production config review — not “nothing done,” but **human/env gates** remain. |

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Ready** | Looks production-usable in-repo with normal ops config. |
| **Partial** | Substantial code/docs exist; hardening, evidence, or config gaps remain. |
| **Blocked** | Prevents or undermines a responsible production launch. |
| **Unknown** | Not enough committed evidence in-repo (e.g. load/SLO proof). |

---

## Full scorecard (by dimension)

| Dimension | Status | Notes |
|-----------|--------|--------|
| Build health | **Ready** | `npm run verify:sow` passes (lint → typecheck → build → test) on current mainline; re-run after large merges. |
| CI | **Ready** | `.github/workflows/ci.yml`: lint, typecheck, `test:ci`, critical `npm audit`, secret scan, startup smoke. |
| Tests | **Partial** | Many `*.test.ts` files; integration coverage; cleanup checklist still lists some gaps. |
| Contracts / API | **Ready** | `openapi.yaml` and `docs/SPEC/02_API_Contracts.md` aligned to `src/server/routes.ts` (2026-03-23). |
| Auth / identity | **Partial** | `/token/exchange`, JWT paths, verified caller context; production IdP/app config required. |
| Rate limiting | **Partial** | Implemented; Redis/multi-instance behavior depends on deployment. |
| Async jobs | **Partial** | Routes exist (`/v1/query/async`, `/v1/jobs/*`); queue backend and compose/docs must match reality. |
| Model gateway | **Partial** | Provider-backed path exists; real keys/endpoints and health checks for prod. |
| Tool gateway | **Partial** | Deny-by-default sensible; executable tools need explicit enablement + review. |
| Workflows / engines | **Partial** | SOW claims broad completion; validate against policy allowlists and integration tests. |
| Memory / retrieval | **Partial** | Multiple backends and limits in code/docs; pick release posture and validate. |
| Observability | **Partial** | L2-04 gate complete; sampling, retention, persistent sinks, staging alert drills deferred. |
| Audit / security | **Partial** | Audit logger, redaction; ops boundaries (mTLS/network) deployment-dependent. |
| Operational endpoints | **Partial** | Bearer protection when `OPERATIONAL_BEARER_TOKEN` set; **probes must match** (K8s/Docker). |
| Config / feature flags | **Ready** | `src/config/schema.ts`, `docs/SPEC/20_Config_and_FeatureFlags.md`; rollout flag default safe. |
| Docker / container build | **Partial** | `Dockerfile` uses `npm ci` in builder + `npm ci --omit=dev` in runtime with copied `dist/`. Validate with `docker build` when Docker is available. |
| Kubernetes / probes | **Partial** | `k8s/base/deployment.yaml` exec probes send `Authorization` when `OPERATIONAL_BEARER_TOKEN` is set. Confirm in target cluster. |
| Deploy automation (e.g. AWS) | **Partial** | `.github/workflows/deploy-aws.yml` exposes `needs.build.outputs.image` via `build-push` step output. |
| Terraform / IaC | **Partial** | Exists; environment-specific validation required. |
| Runbooks | **Partial** | `docs/SPEC/22_Runbooks_and_Operations.md`, `docs/Runbooks/*`; L2-08 still `in progress`. |
| Rollout readiness | **Partial** | `platform_production_rollout_enabled`, `src/rollout/policy.ts`; drills and sign-off open. |
| Governance / evidence | **Blocked** | `docs/PLANS/Implementation-plans/L2-99_Evidence-Checklist.md` is a template — fill owners/evidence. |
| Documentation accuracy | **Partial** | SPEC 02 + OpenAPI reconciled to routes; gaps report / SOW rows may still need manual sweep. |
| Performance / load | **Unknown** | Plans define SLOs; committed load-test artifacts and production baselines not established here. |

---

## Go / no-go checklist (next release)

**Rule:** Release is **GO** only when every **Blocking** item is done and evidence is recorded.

### 1. Repo health — **Blocking**

- [x] `npm run verify:sow` passes on the release branch *(verify locally / on your release branch)*
- [x] Lint: zero errors
- [x] Typecheck passes
- [x] Build passes
- [x] Full test suite passes
- [ ] CI green on the merge commit (not only local) — **needs a real push + green workflow run URL**

**Evidence:** CI run URL, `package.json` script `verify:sow`.

### 2. Contract & docs — **Blocking**

- [x] `openapi.yaml` matches implemented routes
- [x] `docs/SPEC/02_API_Contracts.md` matches sync/async/job behavior in `src/server/routes.ts`
- [ ] `docs/Production-Readiness-Gaps-Report.md` and `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` reconciled with current code
- [ ] No contradictory “complete” or “missing” claims for the same feature

**Evidence:** Doc PR + reviewer sign-off.

### 3. Deployment path — **Blocking**

- [ ] Docker image builds from clean checkout
- [ ] Image runs and serves `/healthz` or agreed probe in target env
- [ ] Deploy pipeline promotes correct image/tag (e.g. GitHub Actions → Terraform/ECS/K8s)
- [ ] Staging deploy succeeds with release config

**Evidence:** Build logs, staging deploy record.

### 4. Health, readiness, probes — **Blocking**

- [ ] `/healthz` and `/readyz` return expected status when dependencies healthy — **tick in staging / after `docker run` smoke**
- [x] Probes (K8s/Docker) include auth **or** ops endpoints allow unauthenticated probes by design — **must match** runtime *(manifests + Dockerfile/compose send Bearer when token is set)*
- [ ] `/v1/version` shows `release_id` / `build_id` when required — **tick after env/config sets `RELEASE_ID` / `BUILD_ID` in target env**

**Evidence:** Staging probe output, manifest snippet.

### 5. Production configuration — **Blocking**

- [ ] IdP + app registry production-safe (no dev defaults in prod)
- [ ] Model provider non-synthetic, keys and endpoints set
- [ ] `RELEASE_ID` / `BUILD_ID` set for traceability
- [ ] `OPERATIONAL_BEARER_TOKEN` or network isolation for ops endpoints
- [ ] Rollout posture: `platform_production_rollout_enabled` explicitly decided

**Evidence:** Secure config review checklist (no secrets in repo).

### 6. Safety controls — **Blocking**

- [ ] End-to-end auth smoke in staging
- [ ] Rate limits validated for intended topology (in-memory vs Redis)
- [ ] Tool posture explicit: deny-only **or** allowlist + sandbox review complete

**Evidence:** Test results, security note.

### 7. Async / queue (if exposed) — **Blocking**

- [ ] Queue backend in deployment matches implemented backends
- [ ] Job submit/status/cancel/list validated in staging — **or** async routes disabled/undocumented for this release

**Evidence:** Staging integration results.

### 8. Memory / retrieval — **Blocking for memory-enabled release**

- [ ] Explicit: retrieval off, dev-only, or production backend + limits validated
- [ ] Retention and chunk limits match config

**Evidence:** Config + staging tests.

### 9. Observability & audit — **Blocking**

- [ ] Audit/event paths writable and monitored
- [ ] Required events/metrics still passing acceptance where used
- [ ] Alert path or on-call visibility agreed for rollout

**Evidence:** L2-04 references, staging checks.

### 10. Operations & governance — **Blocking**

- [ ] Runbooks current (`docs/SPEC/22_Runbooks_and_Operations.md`, `docs/Runbooks/*`)
- [ ] Rollback drill executed and recorded (per L2-08)
- [ ] `docs/PLANS/Implementation-plans/L2-99_Evidence-Checklist.md` filled (owners, evidence links, dates)
- [ ] L2-08 production readiness review tasks complete where required
- [ ] Formal go/no-go decision recorded

**Evidence:** Checklist PDF/links, meeting notes.

---

## Minimum GO criteria (all must be true)

1. `npm run verify:sow` passes  
2. CI green  
3. Public API docs and `openapi.yaml` match `src/server/routes.ts`  
4. Container + deploy pipeline validated end-to-end in staging  
5. Health/readiness probes work with chosen auth model  
6. Production configuration reviewed  
7. Rollback path tested  
8. Evidence checklist and sign-offs complete  

---

## Current recommendation

**NO-GO** for a broad production release until:

- Repository verification is green  
- Documentation is reconciled with runtime  
- Deployment and probe configuration are proven in staging  
- Operational drills and governance evidence are completed  

**Narrower releases** (e.g. internal/staging-only) may still be possible with explicit risk acceptance and scoped features — document constraints in the release notes.

---

## Key file references

| Topic | Path |
|-------|------|
| Gaps and implementation status | `docs/Production-Readiness-Gaps-Report.md` |
| Gap-closure SOW / backlog | `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md` |
| Master plan / phased readiness | `docs/PLANS/00_Master-Delivery-Plan.md` |
| Scope of work | `docs/PLANS/Scope-of-Work.md` |
| Cleanup checklist | `docs/PLANS/Cleanup-and-Finalization-Checklist.md` |
| L2-04 observability gate | `docs/PLANS/Implementation-plans/L2-04_Gate-Report-and-Known-Gaps.md` |
| L2-08 rollout / ops | `docs/PLANS/Implementation-plans/L2-08_Rollout-and-Operational-Readiness-Implementation.md` |
| L2-99 evidence template | `docs/PLANS/Implementation-plans/L2-99_Evidence-Checklist.md` |
| Config & flags | `docs/SPEC/20_Config_and_FeatureFlags.md` |
| API contracts | `docs/SPEC/02_API_Contracts.md` |
| Runbooks index | `docs/SPEC/22_Runbooks_and_Operations.md` |
| Deployment guide | `docs/Production-Deployment-Guide.md` |
| Routes (source of truth for HTTP) | `src/server/routes.ts` |
| CI | `.github/workflows/ci.yml` |
| Verification command | `npm run verify:sow` (see `package.json`) |

---

## Contradictions to resolve (doc hygiene)

1. **Older gap registers** may list items (e.g. missing `/token/exchange`, static `/readyz`) that **code has since implemented** — re-verify line-by-line against `src/server/routes.ts`.  
2. **`docs/Production-Deployment-Guide.md`** is optimistic in places; it must stay consistent with **branch health** and **actual** queue/backend support.  
3. **`openapi.yaml`** and **`docs/SPEC/02_API_Contracts.md`** must match the live route table.  
4. **SOW / Scope-of-Work** “implementation-complete” language does **not** automatically mean production-ready — see `docs/PLANS/SOW-Documentation-Implementation-Gap-Closure.md`.

---

## Optional: what else to track (recommended)

These are not always blocking for a first production cut, but teams often want them explicit. Add rows or checkboxes when they matter for *your* release.

### Release record (fill in per release)

| Field | Value |
|-------|--------|
| Release name / version | |
| Git tag / commit SHA | |
| Release branch | |
| Release captain / DRI | |
| Target deploy window | |
| CI run (green) link | |
| Staging sign-off date | |
| Production GO date | |

### Sign-offs (who approved GO)

| Role | Name | Date | Notes |
|------|------|------|--------|
| Engineering | | | |
| Security / risk | | | |
| Operations / SRE | | | |
| Product / stakeholder | | | optional |

### API & client impact

- [ ] **Breaking changes** listed for API consumers (or “none”).
- [ ] **Migration guide** or release notes published (link).
- [ ] **Deprecation** timeline communicated if any field/route is deprecated.

### Supply chain & platform

- [ ] **`package-lock.json`** committed; `npm ci` used in CI/deploy.
- [ ] **Node version** matches `package.json` `engines` (e.g. Node 20).
- [ ] **`npm audit`** at least at CI level (`critical` fail per `.github/workflows/ci.yml`); review highs if policy requires.
- [ ] **Third-party licenses** acceptable for your org (dependency review if needed).

### Post-deploy smoke (first hour / first day)

- [ ] `/v1/version` or health shows expected `release_id` / `build_id`.
- [ ] Sample authenticated `POST /v1/query` succeeds.
- [ ] Error rate and latency within agreed bounds (see `docs/PLANS/00_Master-Delivery-Plan.md` SLO section).
- [ ] On-call notified; alert routing works for a test or synthetic check.

### Extended references (infra & automation)

| Topic | Path |
|-------|------|
| Docker | `Dockerfile` |
| Compose (local/staging) | `docker-compose.yml` |
| Kubernetes | `k8s/` |
| Terraform | `terraform/` |
| Deploy workflow | `.github/workflows/deploy-aws.yml` (if used) |
| OpenAPI | `openapi.yaml` |

### Compliance & data (org-specific)

Only add items your policy requires; this repo does not replace legal/compliance review.

- Data residency, retention, and PII handling (see architecture and runbooks).
- Audit log access controls and retention in the **deployed** environment.
- Subprocessors / model provider terms for production.

### When to refresh this document

- After each **GO / NO-GO** decision.
- When **`npm run verify:sow`** status changes (green vs red).
- After **major doc reconciliation** (SPEC 02, openapi, gaps report).
- After **first production incident** or rollback — add a short “lessons” bullet at the bottom.

### Last-mile items (easy to forget)

Use when they apply; skip if not relevant.

- [ ] **Release window** — no conflicting deploys; blackout dates / holidays noted.
- [ ] **Code freeze** — release branch or tag-only fixes after cut; merge policy agreed.
- [ ] **Feature-flag snapshot** — document which flags are **on** for this release (`docs/SPEC/20_Config_and_FeatureFlags.md` + env in staging/prod).
- [ ] **External dependencies** — model provider, IdP, Redis, etc. healthy; no planned maintenance during cutover.
- [ ] **Rollback triggers** — numeric thresholds written down (e.g. error rate, p95 latency, budget burn); who can call rollback.
- [ ] **Internal comms** — eng + support know ship time, how to page, link to runbooks.
- [ ] **Customer / partner notice** — if API or behavior changes affect integrators.
- [ ] **Secrets** — no rotation required *during* cut unless planned; post-release rotation scheduled if needed.
- [ ] **Support / on-call** — coverage for the release window + first business day after.
- [ ] **Discoverability** — link to this doc from `README.md` or `docs/Overview.md` so new readers find it.

### Sharp corners & edge cases (optional but real)

These are **not** always in generic checklists; add a line of evidence if your release touches them.

- [ ] **Async / jobs** — idempotency and duplicate-submit behavior understood; job timeouts and stuck-job handling documented.
- [ ] **Webhooks / outbound callbacks** (if used) — SSRF risk, allowlists, signing secrets, retries, and failure behavior reviewed.
- [ ] **CORS** — `CORS_ALLOWED_ORIGINS` (and related env) match production origins; not `*` unless intended.
- [ ] **Multi-tenant isolation** — spot-check that org/app/user scope cannot leak across tenants (memory, retrieval, policy).
- [ ] **Kill switch** — `platform_production_rollout_enabled` (or equivalent) **tested in staging** (flip off → expected 503/block; flip on → recovery).
- [ ] **Cost / token ceiling** — provider spend and tenant caps are acceptable for expected traffic; no surprise bill path.
- [ ] **Synthetic / uptime** — external ping or synthetic check after deploy (not only `/healthz` from inside the cluster).
- [ ] **Release artifact** — tag + **CHANGELOG** or release notes entry; GitHub Release or internal ticket link for auditors.
- [ ] **Security contact** — `SECURITY.md` or security email for reports; process known to the team.
- [ ] **Repo hygiene** — `CODEOWNERS` / required reviews on `main`; Dependabot or equivalent dependency updates (optional but common).
- [ ] **Time & JWTs** — NTP/skew acceptable; token TTLs and clock skew behavior understood for IdP + AI JWT.

### Are we done adding sections?

**Yes, for a general-purpose checklist.** Further items are usually **org-specific**: SOC2 evidence, pen-test gates, formal DPIA, SOC for AI, FedRAMP, image signing, WAF rules, multi-region failover, chaos game days, cost center / billing codes, and JIRA/Linear release tickets. Add those only when your program requires them.

---

*End of summary. Update this file when the release gate status changes.*

---

## Agent: last verification log (optional)

| Date | `verify:sow` | Commit / branch | Notes |
|------|----------------|-----------------|-------|
| 2026-03-23 | pass | (local) | Lint cleanup, OpenAPI/SPEC 02 aligned to `routes.ts`; Dockerfile/probes/deploy workflow fixes. |
