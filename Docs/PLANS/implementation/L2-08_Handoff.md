# L2-08 Sprint Handoff – Rollout and Operational Readiness

**Plan:** L2-08 Rollout and Operational Readiness Implementation  
**Status:** Code and documentation implementation complete; operational phases (drills, sign-off, L2-99 evidence) remain for Operations/SRE  
**Handoff to:** L2-99 Deferred Coding Agent Harness Readiness Gate, Operations/SRE for drills and production readiness  

---

## 1) L2-99 / Operations start checklist

- [x] Feature flag `platform_production_rollout_enabled` (default false); env `PLATFORM_PRODUCTION_ROLLOUT_ENABLED`
- [x] Release metadata: `RELEASE_ID`, `BUILD_ID` optional; exposed in `GET /v1/version` and config
- [x] Rollout policy module: canary thresholds, policy parsing, release config validation (`src/rollout/`)
- [x] `GET /v1/version` returns `contract_version`, `api`, `version`, `env`, and when set `release_id`, `build_id`
- [x] Runbook: Release-and-Rollback (release execution, canary analysis, rollback, emergency mitigation, escalation)
- [x] SPEC 20 and 22 updated; API contracts doc updated for version endpoint
- [x] Unit tests: config (feature flag + release), rollout policy parser, release config validation
- [x] Integration test: GET /v1/version returns expected fields
- [x] Bootstrap logs release-config validation warning when production has no RELEASE_ID/BUILD_ID
- [ ] CI/CD artifact signing and deployment manifests (platform/SRE process)
- [ ] Canary and rollback drills with measured recovery time (Operations)
- [ ] Runbook validation by on-call owners and incident simulation drills
- [ ] Production readiness scorecard and go/no-go decision
- [ ] Operational evidence package and L2-99 handoff briefing

**Definition of ready for L2-99:** Code and runbooks are in place. L2-99 can consume operational context from this handoff and runbooks; formal evidence package and sign-off are operational tasks.

---

## 2) Config and feature flags (L2-08)

| Item | Env / location | Notes |
|------|----------------|--------|
| **platform_production_rollout_enabled** | `PLATFORM_PRODUCTION_ROLLOUT_ENABLED=true` | Kill-switch; default false. Set true only after readiness gate. |
| **Release metadata** | `RELEASE_ID`, `BUILD_ID` | Optional; set at deploy for traceability. Production should set at least one. |
| **App version** | `APP_VERSION` | Optional; shown in `GET /v1/version`. Default `0.1.0`. |

Config schema: `src/config/schema.ts`. Load order and validation: `loadConfigFromEnv()`.

---

## 3) Rollout policy and canary thresholds

**Module:** `src/rollout/policy.ts`

- **parseRolloutPolicy(input)** – parse policy from object (e.g. config); defaults for canary thresholds and `rollback_allowed`.
- **parseCanaryThresholds(input)** – parse canary thresholds (supports string numbers for env).
- **validateReleaseConfig({ env, release_id?, build_id? })** – returns `{ valid, errors }`; production without release_id/build_id yields a validation error.

**Default canary thresholds:**

| Criterion | Default | Meaning |
|-----------|--------|---------|
| max_error_rate_promotion | 0.01 | Max error rate to allow promotion |
| abort_error_rate | 0.05 | Error rate above which canary is aborted |
| max_p95_latency_ratio | 1.1 | Max p95 vs baseline (10% over) |
| observation_window_minutes | 15 | Window before promotion decision |

---

## 4) Operational endpoints

| Endpoint | Purpose |
|---------|---------|
| `GET /healthz` | Liveness; returns `{ status: "ok" }`. |
| `GET /readyz` | Readiness; returns `{ ready: true }`. |
| `GET /metrics` | JSON counters and histograms by default; Prometheus exposition text when `Accept: text/plain` or `?format=prometheus` (see SPEC 18 Observability). |
| `GET /v1/version` | Version and traceability: `contract_version`, `api`, `version`, `env`; when set `release_id`, `build_id`. |

Pre-deploy smoke (runbook): hit healthz, readyz, and version after deploy; confirm version/release_id/build_id and env.

---

## 5) Runbooks and escalation

- **Release and Rollback:** `docs/OPERATIONS/RUNBOOKS/Release-and-Rollback.md` (or `docs/OPERATIONS/RUNBOOKS/` — check both path forms)  
  Release execution, canary analysis, rollback steps, emergency mitigation, kill-switch, escalation path.

- **Escalation (L2-08):** Operations on-call → SRE → Security → Leadership incident commander.

- **Other runbooks:** Observability-and-Eval, CI-Bootstrap-Troubleshooting; see `docs/SPEC/22_Runbooks_and_Operations.md` or `docs/SPEC/22_Runbooks_and_Operations.md`.

---

## 6) CI and verification

| Check | Command / location |
|-------|--------------------|
| Config + rollout unit tests | `npm test` (config/schema.test.ts, rollout/policy.test.ts) |
| Version endpoint | `npm test` (server/query.integration.test.ts – GET /v1/version) |
| Bootstrap (startup smoke) | `npm run build && node dist/bootstrap/index.js` |
| Full test suite | `npm run test` or `npm run test:ci` |

Release config validation runs at bootstrap: in production, if neither RELEASE_ID nor BUILD_ID is set, a warning is logged (non-blocking).

---

## 7) What remains (operational)

- **Phase 0:** CI/CD workflow with signed artifacts; deployment manifests and validation (Platform/SRE).
- **Phase 1:** Canary/rollback drills; kill-switch validation in real environment (Operations).
- **Phase 2:** Incident simulation drills; runbook sign-off by on-call owners (SRE).
- **Phase 3:** Production readiness scorecard; go/no-go decision (Operations + signatories).
- **Phase 4:** Evidence package for L2-99; residual risk register; L2-99 briefing (Operations).

---

## 8) References

- Plan: `docs/PLANS/implementation/L2-08_Rollout-and-Operational-Readiness-Implementation.md` (or `docs/PLANS/`)
- **SOW:** Segment L (L.2a–L.3b, L.5) verifies L2-08 endpoints, runbooks, rollout/on-call documentation; see `docs/PLANS/Scope-of-Work.md` §4.1, §9 Segment L.
- Config/feature flags: `docs/SPEC/20_Config_and_FeatureFlags.md` or `docs/SPEC/20_Config_and_FeatureFlags.md`
- Runbooks index: `docs/SPEC/22_Runbooks_and_Operations.md` or `docs/SPEC/22_Runbooks_and_Operations.md`. SOW L.2b: add sections to Release-and-Rollback or create **Query-and-Policy-Failures.md** (query failure, tool denied, budget exceeded).
- Release runbook: `docs/OPERATIONS/RUNBOOKS/Release-and-Rollback.md` or `docs/OPERATIONS/RUNBOOKS/Release-and-Rollback.md`
- Rollout module: `src/rollout/`
- Config: `src/config/schema.ts`
