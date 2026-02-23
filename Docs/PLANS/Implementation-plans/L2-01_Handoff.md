# L2-01 Sprint Handoff – Contracts and Project Scaffold

**Plan:** L2-01 Contracts and Project Scaffold  
**Status:** Implementation complete  
**Handoff to:** L2-02 MVP Runtime Single Endpoint Chat  

---

## 1) Sprint 1 (L2-02) start checklist

- [x] Contract package merged and versioned (v1)
- [x] All required contracts implemented and validated (RequestEnvelope, ResponseEnvelope, CanonicalRequest, IntentBundle, PolicyDecision, PipelinePlan)
- [x] Error taxonomy defined and linked to contract package
- [x] Module scaffold in place (ingress, brainstem, controlplane, router, gateways, pipelines, observability)
- [x] Bootstrap loads config and validates on startup
- [x] Config schema and feature flags with safe defaults
- [x] CI workflow: lint, typecheck, test, startup smoke
- [x] Seed unit and smoke tests deterministic
- [ ] Readiness review meeting (owner sign-off)
- [ ] L2-02 implementation start

**Definition of ready for L2-02:** All items above except the review meeting are done. L2-02 can start without contract or scaffold blockers.

---

## 2) Contract compatibility matrix (MVP endpoint)

| Contract / area        | Version | MVP (L2-02) use | Notes |
|------------------------|---------|-----------------|--------|
| RequestEnvelope        | v1      | Yes             | Only `contract_version: "v1"` accepted. |
| ResponseEnvelope       | v1      | Yes             | status: ok \| blocked \| error \| accepted |
| CanonicalRequest       | (internal) | Yes          | Brain Stem produces this from RequestEnvelope |
| IntentBundle           | (internal) | Yes          | Brain Stem produces this; chat path uses primary_intent |
| PolicyDecision         | (internal) | Placeholder   | L2-03 implements; MVP can return allow-all placeholder |
| PipelinePlan           | (internal) | Placeholder   | Router stub; MVP uses single chat pipeline |
| Error codes            | —       | Yes             | Use ERROR_TAXONOMY; INVALID_PAYLOAD for envelope validation failures |

**MVP endpoint:** `POST /v1/query` – accept RequestEnvelope (v1), return ResponseEnvelope. Ingress validates envelope; Brain Stem produces CanonicalRequest + IntentBundle; chat pipeline returns ResponseEnvelope.

---

## 3) Schema examples and version policy

### RequestEnvelope (minimal valid)

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "caller": { "app_id": "a1", "user_id": "u1", "org_id": "o1", "scopes": [] },
  "input": { "text": "Hello", "attachments": [] },
  "preferences": { "response_format": "text", "verbosity": "medium", "stream": false },
  "contract_version": "v1"
}
```

### ResponseEnvelope (success)

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ok",
  "output": { "text": "Hi there.", "citations": [] },
  "telemetry": { "tokens_in": 10, "tokens_out": 5, "cost_usd_est": 0, "latency_ms": 100 }
}
```

### Version policy

- **Current supported:** `contract_version: "v1"` only. Any other value is rejected (CONTRACT_VERSION_UNSUPPORTED).
- **Changes:** Additive optional fields are allowed; breaking changes require a new version and explicit migration.
- **Changelog:** `src/contracts/CHANGELOG.md`.

---

## 4) CI commands (local parity with CI)

| CI step        | Local command |
|----------------|----------------|
| Lint           | `npm run lint` |
| Typecheck      | `npm run typecheck` |
| Unit + smoke   | `npm run test` or `npm run test:ci` (with coverage) |
| Build          | `npm run build` |
| Startup smoke  | `node dist/bootstrap/index.js` |

Full CI: `.github/workflows/ci.yml` runs on push/PR to `main`.

---

## 5) Known limits

- **Contracts:** Only v1 supported; no streaming schema yet.
- **Scaffold:** All component modules are interfaces/stubs only; no real routing, policy, or pipeline execution.
- **Config:** Env-based only; no central config service.
- **CI:** No dependency or secret scanning yet (plan §9.3 calls for it in follow-up).

---

## 6) Open risks and owners

| Risk | Owner | Mitigation |
|------|--------|-------------|
| Contract field churn blocks L2-02 | Platform Lead | Change policy in CHANGELOG; avoid breaking changes to v1. |
| Hidden dependency gaps for MVP | Runtime Lead | Use this handoff checklist; add integration test for envelope → response path in L2-02. |
| Config drift between environments | Platform Lead | Single config schema; document env vars in README/config reference. |

---

## 7) References

- Contract package: `src/contracts/` (schemas, validators, errors)
- Config: `src/config/schema.ts`; feature flags in config.flags
- Bootstrap: `src/bootstrap/index.ts`
- CI: `.github/workflows/ci.yml`
- Runbook: `Docs/Runbooks/CI-Bootstrap-Troubleshooting.md`
